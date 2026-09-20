import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { isAiConfigured } from "./gateway";
import {
  getInventoryOverview,
  listProductsForAdmin,
  listRetailOrdersForAdmin,
  LOW_STOCK_THRESHOLD,
} from "@/lib/retail/service";
import { formatPrice } from "@/lib/format";

const DEFAULT_MODEL = "claude-sonnet-5";
const MAX_TOOL_ROUNDS = 6;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export type ChatMessage = { role: "user" | "assistant"; text: string };

// Every field the model can set is optional here on purpose — a proposal
// only ever carries the fields the owner asked to change, and the execute
// endpoint (src/app/api/admin/assistant/execute/route.ts) re-validates
// whatever the model filled in through the exact same Zod schema the manual
// admin UI uses, so a malformed or out-of-range value from the model is
// rejected there, not trusted here.
export type AssistantAction =
  | {
      type: "create_product";
      title: string;
      category: string;
      brand?: string;
      description: string;
      size?: string;
      condition: string;
      source: string;
      priceCents: number;
      currency: string;
      quantity: number;
    }
  | {
      type: "update_product";
      id: string;
      title?: string;
      priceCents?: number;
      currency?: string;
      quantity?: number;
      active?: boolean;
    }
  | { type: "delete_product"; id: string };

export type AssistantTurnResult =
  | { kind: "message"; text: string }
  | { kind: "proposal"; action: AssistantAction; summary: string };

const SYSTEM_PROMPT = `You are the admin operations assistant for Ease Wear, a wearable-art
studio that also runs a retail shop (surplus branded stock + thrifted jackets).
You help the store owner check inventory, stock, and sales numbers, and make
catalog changes through conversation.

Rules:
- Use the read tools (get_inventory_overview, list_products, list_retail_orders)
  to look up real numbers before answering. Never guess or invent figures.
- To create, edit, or delete a product, call the matching propose_* tool.
  Proposing is as far as you go — you never claim a change has been made.
  The owner reviews and confirms it themselves before anything is written.
- When the owner asks for a relative stock change ("add 10", "restock by 5"),
  first call list_products to find the current quantity, then propose the
  resulting absolute quantity.
- "price" in every tool is the currency's major unit (e.g. 499.00 rupees),
  never paise/cents.
- Keep answers short and concrete — plain sentences with real numbers and
  product names. No markdown headers or tables.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_inventory_overview",
    description:
      "Get store-wide stock and sales numbers: SKU count, units in stock, stock value, out-of-stock/low-stock counts, units sold, retail revenue, average order value, and a per-category breakdown.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_products",
    description: "List products in the catalog, optionally filtered.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Case-insensitive substring match on product title or brand." },
        category: { type: "string", description: "Exact category filter, e.g. 'denim', 'shirts'." },
        lowStockOnly: {
          type: "boolean",
          description: "Only include products at or below the low-stock threshold (including out of stock).",
        },
        limit: { type: "number", description: "Max results, default 20." },
      },
    },
  },
  {
    name: "list_retail_orders",
    description: "List recent retail orders with status, items, and totals.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filter by order status: pending, paid, fulfilled, or cancelled." },
        limit: { type: "number", description: "Max results, default 10." },
      },
    },
  },
  {
    name: "propose_create_product",
    description: "Propose creating a new product. Not executed until the owner confirms.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        category: { type: "string", description: "One of: shirts, t_shirts, denim, cargos, shoes, activewear, jackets" },
        brand: { type: "string" },
        description: { type: "string" },
        size: { type: "string" },
        condition: { type: "string", description: "One of: new, like_new, good, fair" },
        source: { type: "string", description: "One of: surplus_branded, thrifted_imported" },
        price: { type: "number", description: "Price in the currency's major unit, e.g. 499.00" },
        currency: { type: "string", description: "3-letter currency code, e.g. inr, usd" },
        quantity: { type: "number" },
      },
      required: ["title", "category", "description", "condition", "source", "price", "currency", "quantity"],
    },
  },
  {
    name: "propose_update_product",
    description:
      "Propose changing an existing product's price, currency, stock quantity, title, or active status. Only include fields that should change. Look the product up with list_products first to get its id.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        price: { type: "number", description: "New price in the currency's major unit." },
        currency: { type: "string" },
        quantity: { type: "number" },
        active: { type: "boolean" },
      },
      required: ["id"],
    },
  },
  {
    name: "propose_delete_product",
    description: "Propose permanently deleting a product. Look it up with list_products first to get its id.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
];

const READ_TOOL_NAMES = new Set(["get_inventory_overview", "list_products", "list_retail_orders"]);

async function runReadTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  if (name === "get_inventory_overview") {
    const o = await getInventoryOverview();
    return {
      totalSkus: o.totalSkus,
      totalUnitsInStock: o.totalUnitsInStock,
      outOfStockCount: o.outOfStock.length,
      outOfStockProducts: o.outOfStock.map((p) => p.title),
      lowStockCount: o.lowStock.length,
      lowStockProducts: o.lowStock.map((p) => ({ title: p.title, quantity: p.quantity })),
      stockValueByCurrency: Object.fromEntries(o.stockValueByCurrency.map(([c, cents]) => [c, formatPrice(cents, c)])),
      retailOrdersCount: o.retailOrdersCount,
      unitsSold: o.unitsSold,
      retailRevenueByCurrency: Object.fromEntries(o.revenueByCurrency.map(([c, cents]) => [c, formatPrice(cents, c)])),
      retailAovByCurrency: Object.fromEntries(o.aovByCurrency.map(([c, cents]) => [c, formatPrice(cents, c)])),
      byCategory: o.byCategory.map((c) => ({ category: c.category, skus: c.count, units: c.units })),
    };
  }
  if (name === "list_products") {
    const all = await listProductsForAdmin();
    let filtered = all;
    if (typeof input.category === "string") filtered = filtered.filter((p) => p.category === input.category);
    if (input.lowStockOnly) filtered = filtered.filter((p) => p.quantity <= LOW_STOCK_THRESHOLD);
    if (typeof input.query === "string") {
      const q = input.query.toLowerCase();
      filtered = filtered.filter((p) => p.title.toLowerCase().includes(q) || (p.brand ?? "").toLowerCase().includes(q));
    }
    const limit = typeof input.limit === "number" ? input.limit : 20;
    return filtered.slice(0, limit).map((p) => ({
      id: p.id,
      title: p.title,
      category: p.category,
      brand: p.brand,
      price: formatPrice(p.priceCents, p.currency),
      currency: p.currency,
      quantity: p.quantity,
      active: p.active,
    }));
  }
  if (name === "list_retail_orders") {
    const all = await listRetailOrdersForAdmin();
    let filtered = all;
    if (typeof input.status === "string") filtered = filtered.filter((o) => o.status === input.status);
    const limit = typeof input.limit === "number" ? input.limit : 10;
    return filtered.slice(0, limit).map((o) => ({
      id: o.id,
      customer: o.customer.name,
      status: o.status,
      total: formatPrice(o.subtotalCents, o.currency),
      items: o.items.length,
      createdAt: o.createdAt.toISOString(),
    }));
  }
  throw new Error(`Unknown read tool: ${name}`);
}

function buildProposal(name: string, input: Record<string, unknown>): { action: AssistantAction; summary: string } {
  if (name === "propose_create_product") {
    const title = String(input.title);
    const category = String(input.category);
    const currency = String(input.currency);
    const quantity = Number(input.quantity);
    const priceCents = Math.round(Number(input.price) * 100);
    return {
      action: {
        type: "create_product",
        title,
        category,
        brand: typeof input.brand === "string" && input.brand ? input.brand : undefined,
        description: String(input.description ?? title),
        size: typeof input.size === "string" && input.size ? input.size : undefined,
        condition: String(input.condition ?? "good"),
        source: String(input.source),
        priceCents,
        currency,
        quantity,
      },
      summary: `Create "${title}" · ${category.replace(/_/g, " ")} · ${formatPrice(priceCents, currency)} · qty ${quantity}`,
    };
  }

  if (name === "propose_update_product") {
    const id = String(input.id);
    const action: AssistantAction = { type: "update_product", id };
    const changes: string[] = [];
    if (typeof input.title === "string") {
      action.title = input.title;
      changes.push(`title → "${input.title}"`);
    }
    const currency = typeof input.currency === "string" ? input.currency : undefined;
    if (currency) {
      action.currency = currency;
      changes.push(`currency → ${currency.toUpperCase()}`);
    }
    if (typeof input.price === "number") {
      const priceCents = Math.round(input.price * 100);
      action.priceCents = priceCents;
      changes.push(`price → ${formatPrice(priceCents, currency ?? "inr")}`);
    }
    if (typeof input.quantity === "number") {
      action.quantity = input.quantity;
      changes.push(`stock → ${input.quantity}`);
    }
    if (typeof input.active === "boolean") {
      action.active = input.active;
      changes.push(input.active ? "set active" : "set inactive");
    }
    return { action, summary: `Update product: ${changes.join(", ") || "no changes"}` };
  }

  if (name === "propose_delete_product") {
    return { action: { type: "delete_product", id: String(input.id) }, summary: "Permanently delete this product" };
  }

  throw new Error(`Unknown action tool: ${name}`);
}

export async function runAssistantTurn(history: ChatMessage[]): Promise<AssistantTurnResult> {
  if (!isAiConfigured()) {
    return { kind: "message", text: "The AI assistant isn't configured yet (missing ANTHROPIC_API_KEY)." };
  }

  const anthropic = getClient();
  const messages: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.text }));

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
      tools: TOOLS,
    });

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    if (toolUses.length === 0) {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return { kind: "message", text: text || "I don't have anything to add." };
    }

    // An action proposal always ends the turn immediately, without executing
    // anything — any read-tool calls made in the same response are simply
    // skipped, since the model already had enough context to propose
    // something concrete.
    const actionCall = toolUses.find((t) => !READ_TOOL_NAMES.has(t.name));
    if (actionCall) {
      const { action, summary } = buildProposal(actionCall.name, actionCall.input as Record<string, unknown>);
      return { kind: "proposal", action, summary };
    }

    messages.push({ role: "assistant", content: response.content });
    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUses.map(async (t) => ({
        type: "tool_result" as const,
        tool_use_id: t.id,
        content: JSON.stringify(await runReadTool(t.name, t.input as Record<string, unknown>)),
      })),
    );
    messages.push({ role: "user", content: toolResults });
  }

  return { kind: "message", text: "I wasn't able to finish looking that up — try asking a narrower question." };
}
