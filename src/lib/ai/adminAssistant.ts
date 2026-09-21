import "server-only";
import {
  GoogleGenAI,
  ApiError as GeminiApiError,
  type Content,
  type FunctionCall,
  type FunctionDeclaration,
} from "@google/genai";
import { isAiConfigured } from "./gateway";
import {
  getInventoryOverview,
  listProductsForAdmin,
  listRetailOrdersForAdmin,
  LOW_STOCK_THRESHOLD,
} from "@/lib/retail/service";
import { formatPrice } from "@/lib/format";

// "gemini-flash-latest" tracks whatever Google's newest Flash model is,
// which is exactly the problem: newly-launched models see heavy demand and
// intermittent 503s before capacity catches up (confirmed against the real
// API while wiring this up). Pinning to a specific, already-stable model
// avoids riding that wave; override via GEMINI_MODEL once a newer one proves
// reliable for function-calling specifically.
const DEFAULT_MODEL = "gemini-3.5-flash";
const MAX_TOOL_ROUNDS = 6;

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
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
  | { type: "delete_product"; id: string }
  | {
      type: "bulk_update_stock";
      // title is display-only (for a readable confirmation summary) — the
      // actual write is keyed by id alone, same as update_product.
      updates: { id: string; title: string; quantity: number }[];
    }
  | {
      type: "bulk_create_size_variants";
      templateProductId: string;
      // display-only, same reasoning as bulk_update_stock's title field.
      templateTitle: string;
      items: { size: string; quantity: number }[];
    };

export type AssistantTurnResult =
  | { kind: "message"; text: string }
  | { kind: "proposal"; action: AssistantAction; summary: string };

// A function, not a constant — must reflect the real date at call time, not
// whatever it happened to be when this module was first loaded (a
// serverless function's module scope can be reused across invocations).
// Conversation history entries are date-stamped too (see
// assistantHistory.ts's toModelHistory), so the model can ground relative
// phrases like "last week" or "since Monday" against real dates instead of
// its training cutoff or the order messages merely happen to arrive in.
function buildSystemPrompt(): string {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "UTC" });
  return `You are the admin operations assistant for Ease Wear, a wearable-art
studio that also runs a retail shop (surplus branded stock + thrifted jackets).
You help the store owner check inventory, stock, and sales numbers, and make
catalog changes through conversation.

Today's date is ${today} (UTC). Conversation history lines are prefixed with
the date they were sent, e.g. "[2026-09-18] restock the jackets" — use both
to answer date-relative questions ("since last week", "how long ago") against
real dates, never a guess. That "[date]" prefix is a reading aid for you
only — never copy it into your own replies.

Rules:
- Use the read tools (get_inventory_overview, list_products, list_retail_orders)
  to look up real numbers before answering. Never guess or invent figures.
- To create, edit, or delete a product, call the matching propose_* tool.
  Proposing is as far as you go — you never claim a change has been made.
  The owner reviews and confirms it themselves before anything is written.
- When the owner asks for a relative stock change ("add 10", "restock by 5"),
  first call list_products to find the current quantity, then propose the
  resulting absolute quantity.
- When the owner gives several stock changes at once (e.g. a shipment's
  received quantities across many products — "Snitch Shirts 28, Jack & Jones
  Jeans 26, ..."), call list_products (however many times needed) to resolve
  every item's id and current quantity, then propose all of them together in
  one propose_bulk_update_products call — never one propose_update_product
  call per item. If a name in the list doesn't clearly match any product,
  leave it out and say so in your reply rather than guessing which product
  it meant.
- When the owner reports per-size stock for a style (e.g. "Snitch Shirt
  M-5, L-5, Xl-3"), call list_products for that style's name first, then
  split the sizes into two groups:
  - Sizes that already have their own matching product (same title and
    size) → one propose_bulk_update_products call, using the supplier's
    number as the new absolute quantity (these are total-in-stock counts,
    not deltas to add on top of what's there).
  - Sizes with no matching product yet, where another product of the same
    style already exists under any size (including one with no size set at
    all) → one propose_bulk_create_size_variants call, using that existing
    product as templateProductId so its price, category, brand, condition,
    source, description, images, and video carry over unchanged. Never
    invent those details yourself.
  If a style has both kinds, propose the updates first — you can propose
  the creates in a follow-up reply once the owner confirms those.
  If nothing under that style exists in the catalog at all, don't propose
  anything for it: tell the owner what's missing (category, price,
  condition, source, description) so they can give you those first.
  If the sizes you're about to create would come from splitting a product
  that had no size of its own (one row covering the whole style), say so
  in your reply and ask whether that row's own quantity should be zeroed
  out afterward, so the style's stock isn't counted twice — don't fold
  that into the same proposal without asking.
- "price" in every tool is the currency's major unit (e.g. 499.00 rupees),
  never paise/cents.
- Keep answers short and concrete — plain sentences with real numbers and
  product names. No markdown headers or tables.`;
}

const TOOLS: FunctionDeclaration[] = [
  {
    name: "get_inventory_overview",
    description:
      "Get store-wide stock and sales numbers: SKU count, units in stock, stock value, out-of-stock/low-stock counts, units sold, retail revenue, average order value, and a per-category breakdown.",
    parametersJsonSchema: { type: "object", properties: {} },
  },
  {
    name: "list_products",
    description: "List products in the catalog, optionally filtered.",
    parametersJsonSchema: {
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
    parametersJsonSchema: {
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
    parametersJsonSchema: {
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
    parametersJsonSchema: {
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
    parametersJsonSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "propose_bulk_update_products",
    description:
      "Propose a stock-quantity change to several products at once — e.g. applying a shipment's received quantities across many products in one go. Look every product up with list_products first to get its id and current quantity.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        updates: {
          type: "array",
          minItems: 2,
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string", description: "The product's title, for display in the confirmation." },
              quantity: { type: "number", description: "The resulting absolute quantity, not a delta." },
            },
            required: ["id", "title", "quantity"],
          },
        },
      },
      required: ["updates"],
    },
  },
  {
    name: "propose_bulk_create_size_variants",
    description:
      "Propose creating several new size-variant listings for a style that already has at least one product in the catalog, cloning that product's price, category, brand, description, condition, source, images, and video — only the size and quantity differ per new listing. Look up an existing product of this style with list_products first to get its id and title. Never use this for a style with no existing product at all — propose_create_product needs real price/category/condition/source details from the owner for that instead.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        templateProductId: {
          type: "string",
          description: "id of an existing product of this style to clone shared details from",
        },
        templateTitle: { type: "string", description: "That product's title, for display in the confirmation." },
        items: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              size: { type: "string" },
              quantity: { type: "number" },
            },
            required: ["size", "quantity"],
          },
        },
      },
      required: ["templateProductId", "templateTitle", "items"],
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
      size: p.size,
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

  if (name === "propose_bulk_update_products") {
    const rawUpdates = Array.isArray(input.updates) ? input.updates : [];
    const updates = rawUpdates.map((u) => {
      const item = u as Record<string, unknown>;
      return { id: String(item.id), title: String(item.title), quantity: Number(item.quantity) };
    });
    const lines = updates.map((u) => `${u.title} → ${u.quantity}`);
    return {
      action: { type: "bulk_update_stock", updates },
      summary: `Update stock for ${updates.length} products:\n${lines.join("\n")}`,
    };
  }

  if (name === "propose_bulk_create_size_variants") {
    const templateProductId = String(input.templateProductId);
    const templateTitle = String(input.templateTitle);
    const rawItems = Array.isArray(input.items) ? input.items : [];
    const items = rawItems.map((it) => {
      const item = it as Record<string, unknown>;
      return { size: String(item.size), quantity: Number(item.quantity) };
    });
    const lines = items.map((it) => `${it.size} → ${it.quantity}`);
    return {
      action: { type: "bulk_create_size_variants", templateProductId, templateTitle, items },
      summary: `Create ${items.length} new "${templateTitle}" size listings:\n${lines.join("\n")}`,
    };
  }

  throw new Error(`Unknown action tool: ${name}`);
}

export async function runAssistantTurn(history: ChatMessage[]): Promise<AssistantTurnResult> {
  if (!isAiConfigured()) {
    return { kind: "message", text: "The AI assistant isn't configured yet (missing GEMINI_API_KEY)." };
  }

  try {
    return await runAssistantTurnInner(history);
  } catch (err) {
    // Surface a real Gemini API error (bad/expired key, no quota, rate
    // limited, temporarily overloaded, ...) as a normal chat reply instead
    // of a generic 500 — this is exactly the kind of thing an admin needs
    // to see in plain language to fix themselves, not something to dig out
    // of server logs for.
    if (err instanceof GeminiApiError) {
      // err.message is often the raw JSON response body
      // ({"error":{"code","message","status"}}) rather than a plain string —
      // pull out the human-readable part instead of dumping that into chat.
      let detail = err.message;
      try {
        const parsed = JSON.parse(err.message) as { error?: { message?: string } };
        detail = parsed.error?.message ?? err.message;
      } catch {
        // err.message wasn't JSON — use it as-is.
      }
      return { kind: "message", text: `The AI assistant hit an error talking to Gemini: ${detail}` };
    }
    throw err;
  }
}

function historyToContents(history: ChatMessage[]): Content[] {
  return history.map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.text }],
  }));
}

// Same reasoning as gateway.ts's retry (see the comment there): 503
// "currently experiencing high demand" is transient and confirmed to clear
// up within a few seconds, not something worth failing a whole request
// over — this matters even more here than in gateway.ts's single-shot
// callStructured, since a multi-round tool-calling turn (e.g. proposing a
// bulk restock) has more individual model calls that could each hit it.
const RETRYABLE_STATUS = new Set([429, 503]);
const RETRY_DELAYS_MS = [500, 1500, 3000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateWithRetry(ai: GoogleGenAI, contents: Content[]) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
        contents,
        config: {
          systemInstruction: buildSystemPrompt(),
          // Raised from 1024: a bulk-update call's arguments (a dozen
          // {id, title, quantity} objects) can run long enough to risk
          // truncation at the old limit.
          maxOutputTokens: 2048,
          tools: [{ functionDeclarations: TOOLS }],
        },
      });
    } catch (err) {
      const retryable = err instanceof GeminiApiError && RETRYABLE_STATUS.has(err.status);
      if (!retryable || attempt >= RETRY_DELAYS_MS.length) throw err;
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
}

async function runAssistantTurnInner(history: ChatMessage[]): Promise<AssistantTurnResult> {
  const ai = getClient();
  const contents: Content[] = historyToContents(history);

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await generateWithRetry(ai, contents);

    const calls = response.functionCalls ?? [];

    if (calls.length === 0) {
      const text = (response.text ?? "").trim();
      return { kind: "message", text: text || "I don't have anything to add." };
    }

    // An action proposal always ends the turn immediately, without executing
    // anything — any read-tool calls made in the same response are simply
    // skipped, since the model already had enough context to propose
    // something concrete.
    const actionCall = calls.find((c) => c.name && !READ_TOOL_NAMES.has(c.name));
    if (actionCall?.name) {
      const { action, summary } = buildProposal(actionCall.name, actionCall.args ?? {});
      return { kind: "proposal", action, summary };
    }

    // The model's own turn (including the functionCall parts) has to be
    // echoed back verbatim before the function results, exactly as Gemini
    // returned it — reconstructing it by hand risks dropping fields the SDK
    // set that aren't represented in the FunctionCall type alone.
    const modelContent = response.candidates?.[0]?.content;
    if (modelContent) contents.push(modelContent);

    const responseParts = await Promise.all(
      calls.map(async (c: FunctionCall) => ({
        functionResponse: {
          id: c.id,
          name: c.name,
          response: { result: await runReadTool(c.name ?? "", c.args ?? {}) },
        },
      })),
    );
    contents.push({ role: "user", parts: responseParts });
  }

  return { kind: "message", text: "I wasn't able to finish looking that up — try asking a narrower question." };
}
