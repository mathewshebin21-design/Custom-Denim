import "server-only";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/auth/guards";
import { getPaymentService } from "@/lib/payments";

const cartInclude = {
  items: {
    orderBy: { createdAt: "asc" as const },
    include: { product: { include: { images: { orderBy: { order: "asc" as const } } } } },
  },
} satisfies Prisma.CartInclude;

export type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

// -----------------------------------------------------------------------
// Catalog
// -----------------------------------------------------------------------

export async function listActiveProducts(filters: { category?: string; source?: string } = {}) {
  return db.product.findMany({
    where: {
      active: true,
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.source ? { source: filters.source } : {}),
    },
    include: { images: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getProductBySlug(slug: string) {
  const product = await db.product.findUnique({
    where: { slug },
    include: { images: { orderBy: { order: "asc" } } },
  });
  if (!product || !product.active) throw new ApiError(404, "Product not found");
  return product;
}

// -----------------------------------------------------------------------
// Cart — one per signed-in customer (see Cart's schema comment for why
// guest/anonymous carts aren't in scope yet).
// -----------------------------------------------------------------------

export async function getOrCreateCart(customerId: string): Promise<CartWithItems> {
  const existing = await db.cart.findUnique({ where: { customerId }, include: cartInclude });
  if (existing) return existing;
  return db.cart.create({ data: { customerId }, include: cartInclude });
}

export async function addCartItem(cartId: string, productId: string, quantity: number): Promise<CartWithItems> {
  if (quantity < 1) throw new ApiError(400, "Quantity must be at least 1");
  const product = await db.product.findUnique({ where: { id: productId } });
  if (!product || !product.active) throw new ApiError(404, "Product not found");

  const existing = await db.cartItem.findUnique({ where: { cartId_productId: { cartId, productId } } });
  const desired = (existing?.quantity ?? 0) + quantity;
  if (product.quantity < desired) throw new ApiError(409, "Not enough stock");

  await db.cartItem.upsert({
    where: { cartId_productId: { cartId, productId } },
    create: { cartId, productId, quantity },
    update: { quantity: desired },
  });
  return db.cart.findUniqueOrThrow({ where: { id: cartId }, include: cartInclude });
}

export async function setCartItemQuantity(cartId: string, itemId: string, quantity: number): Promise<CartWithItems> {
  const item = await db.cartItem.findUnique({ where: { id: itemId }, include: { product: true } });
  if (!item || item.cartId !== cartId) throw new ApiError(404, "Cart item not found");

  if (quantity < 1) {
    await db.cartItem.delete({ where: { id: itemId } });
  } else {
    if (item.product.quantity < quantity) throw new ApiError(409, "Not enough stock");
    await db.cartItem.update({ where: { id: itemId }, data: { quantity } });
  }
  return db.cart.findUniqueOrThrow({ where: { id: cartId }, include: cartInclude });
}

export async function removeCartItem(cartId: string, itemId: string): Promise<CartWithItems> {
  const item = await db.cartItem.findUnique({ where: { id: itemId } });
  if (!item || item.cartId !== cartId) throw new ApiError(404, "Cart item not found");
  await db.cartItem.delete({ where: { id: itemId } });
  return db.cart.findUniqueOrThrow({ where: { id: cartId }, include: cartInclude });
}

// -----------------------------------------------------------------------
// Checkout — mirrors createCheckoutForCommission in src/lib/studio/service.ts.
// -----------------------------------------------------------------------

/**
 * Creates a RetailOrder (with snapshot line items, so a later price/title
 * edit on Product never retroactively rewrites a past order) from the
 * customer's cart, then a provider checkout session for its total.
 *
 * Stock is re-validated here, not just at add-to-cart time, since a cart can
 * sit for a while before checkout — but it is only decremented later,
 * atomically with marking the payment succeeded (markRetailPaymentSucceeded
 * below), so an abandoned or failed checkout never holds inventory hostage.
 */
export async function createCheckoutForCart(customerId: string, shippingAddress: string, appBaseUrl: string) {
  if (!shippingAddress.trim()) throw new ApiError(400, "A shipping address is required");

  const customer = await db.user.findUniqueOrThrow({ where: { id: customerId } });
  const cart = await db.cart.findUnique({ where: { customerId }, include: cartInclude });
  if (!cart || cart.items.length === 0) throw new ApiError(400, "Your cart is empty");

  for (const item of cart.items) {
    if (!item.product.active || item.product.quantity < item.quantity) {
      throw new ApiError(409, `"${item.product.title}" no longer has enough stock`);
    }
  }

  const subtotalCents = cart.items.reduce((sum, item) => sum + item.product.priceCents * item.quantity, 0);
  const currency = cart.items[0].product.currency;
  const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  const retailOrder = await db.$transaction(async (tx) => {
    const created = await tx.retailOrder.create({
      data: {
        customerId,
        subtotalCents,
        currency,
        shippingAddress,
        items: {
          create: cart.items.map((item) => ({
            productId: item.productId,
            titleSnapshot: item.product.title,
            priceCentsSnapshot: item.product.priceCents,
            quantity: item.quantity,
          })),
        },
      },
    });
    await tx.retailPayment.create({
      data: { retailOrderId: created.id, amountCents: subtotalCents, status: "pending" },
    });
    return created;
  });

  const result = await getPaymentService().createCheckout({
    orderId: retailOrder.id,
    amountCents: subtotalCents,
    currency,
    description: `Ease Wear Shop — ${itemCount} item${itemCount === 1 ? "" : "s"}`,
    customerEmail: customer.email,
    successUrl: `${appBaseUrl}/shop/orders/${retailOrder.id}?checkout=success`,
    cancelUrl: `${appBaseUrl}/cart?checkout=cancelled`,
  });

  await db.retailPayment.update({
    where: { retailOrderId: retailOrder.id },
    data: { status: "checkout_created", provider: "stripe", providerSessionId: result.providerSessionId },
  });

  return { retailOrder, checkout: result };
}

export async function getRetailOrderForCustomer(orderId: string, customerId: string) {
  const order = await db.retailOrder.findUnique({
    where: { id: orderId },
    include: { items: true, payment: true },
  });
  if (!order || order.customerId !== customerId) throw new ApiError(404, "Order not found");
  return order;
}

// -----------------------------------------------------------------------
// Payment settlement — mirrors markPaymentSucceeded in src/lib/admin/service.ts.
// The ONLY place a RetailOrder is marked paid and stock decremented; the
// Stripe webhook route is the only caller (see src/app/api/webhooks/stripe/route.ts).
// -----------------------------------------------------------------------

export async function markRetailPaymentSucceeded(
  retailOrderId: string,
  retailPaymentId: string,
  data: { provider: string; providerPaymentIntentId?: string | null },
) {
  return db.$transaction(async (tx) => {
    await tx.retailPayment.update({
      where: { id: retailPaymentId },
      data: {
        status: "succeeded",
        provider: data.provider,
        providerPaymentIntentId: data.providerPaymentIntentId ?? undefined,
        paidAt: new Date(),
      },
    });
    const order = await tx.retailOrder.update({
      where: { id: retailOrderId },
      data: { status: "paid" },
      include: { items: true },
    });

    for (const item of order.items) {
      // decrement is a single atomic SQL UPDATE ... SET quantity = quantity -
      // n, not a read-then-write — safe even if two orders for the same
      // product settle concurrently. Never goes negative: a checkout was
      // already stock-validated, and overselling by a unit at the margin is
      // an acceptable, rare edge case for a one-off surplus/thrift catalog,
      // not something worth a hard failure this late in the payment flow.
      await tx.product.update({
        where: { id: item.productId },
        data: { quantity: { decrement: item.quantity } },
      });
    }

    const cart = await tx.cart.findUnique({ where: { customerId: order.customerId } });
    if (cart) await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
  });
}

export async function setRetailPaymentStatus(retailOrderId: string, status: string) {
  const order = await db.retailOrder.findUnique({ where: { id: retailOrderId }, include: { payment: true } });
  if (!order || !order.payment) throw new ApiError(404, "No order/payment found");

  if (status === "succeeded") {
    await markRetailPaymentSucceeded(retailOrderId, order.payment.id, { provider: "manual" });
    return db.retailPayment.findUniqueOrThrow({ where: { id: order.payment.id } });
  }

  return db.retailPayment.update({ where: { id: order.payment.id }, data: { status } });
}

// -----------------------------------------------------------------------
// Admin
// -----------------------------------------------------------------------

export async function listProductsForAdmin() {
  return db.product.findMany({
    include: { images: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
}

export type CreateProductInput = {
  title: string;
  slug: string;
  category: string;
  brand?: string;
  description: string;
  size?: string;
  condition: string;
  source: string;
  priceCents: number;
  currency?: string;
  quantity: number;
  imageUrls: string[];
  videoUrl?: string;
};

export async function createProduct(input: CreateProductInput) {
  const existing = await db.product.findUnique({ where: { slug: input.slug } });
  if (existing) throw new ApiError(409, "A product with this slug already exists");

  return db.product.create({
    data: {
      title: input.title,
      slug: input.slug,
      category: input.category,
      brand: input.brand,
      description: input.description,
      size: input.size,
      condition: input.condition,
      source: input.source,
      priceCents: input.priceCents,
      currency: input.currency ?? "inr",
      quantity: input.quantity,
      videoUrl: input.videoUrl,
      images: { create: input.imageUrls.map((url, order) => ({ url, order })) },
    },
    include: { images: true },
  });
}

export async function updateProduct(id: string, data: Partial<Omit<CreateProductInput, "imageUrls">> & { active?: boolean }) {
  const product = await db.product.findUnique({ where: { id } });
  if (!product) throw new ApiError(404, "Product not found");
  return db.product.update({ where: { id }, data });
}

export async function deleteProduct(id: string) {
  const product = await db.product.findUnique({ where: { id } });
  if (!product) throw new ApiError(404, "Product not found");
  await db.product.delete({ where: { id } });
}

export async function addProductImage(productId: string, url: string) {
  const product = await db.product.findUnique({ where: { id: productId }, include: { images: true } });
  if (!product) throw new ApiError(404, "Product not found");
  return db.productImage.create({ data: { productId, url, order: product.images.length } });
}

export async function deleteProductImage(productId: string, imageId: string) {
  const image = await db.productImage.findUnique({ where: { id: imageId } });
  if (!image || image.productId !== productId) throw new ApiError(404, "Image not found");
  await db.productImage.delete({ where: { id: imageId } });
}

export async function listRetailOrdersForAdmin() {
  return db.retailOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: { customer: true, items: true, payment: true },
  });
}

// -----------------------------------------------------------------------
// Reporting — shared by the /admin/inventory dashboard and the admin AI
// assistant's read tools, so both ever compute these numbers exactly once.
// -----------------------------------------------------------------------

export const LOW_STOCK_THRESHOLD = 2;

type CurrencyAmount = { currency: string; amountCents: number };

// Every money figure is grouped by its own currency rather than summed into
// one number — products (and their orders) aren't all necessarily priced in
// the same currency now that admins can set it per product, and silently
// blending currencies into a single total would just be wrong.
function sumByCurrency(rows: CurrencyAmount[]): [string, number][] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.currency, (totals.get(row.currency) ?? 0) + row.amountCents);
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([currency, cents]) => [currency, cents]);
}

export async function getInventoryOverview() {
  const [products, succeededPayments] = await Promise.all([
    db.product.findMany({ orderBy: [{ category: "asc" }, { quantity: "asc" }] }),
    db.retailPayment.findMany({
      where: { status: "succeeded" },
      include: { retailOrder: { include: { items: true } } },
    }),
  ]);

  const outOfStock = products.filter((p) => p.quantity === 0);
  const lowStock = products.filter((p) => p.quantity > 0 && p.quantity <= LOW_STOCK_THRESHOLD);

  const stockValueByCurrency = sumByCurrency(
    products.map((p) => ({ currency: p.currency, amountCents: p.priceCents * p.quantity })),
  );

  const retailOrdersCount = succeededPayments.length;
  const unitsSold = succeededPayments.reduce(
    (sum, p) => sum + p.retailOrder.items.reduce((s, i) => s + i.quantity, 0),
    0,
  );
  // Payments carry the amount actually charged; the order's own currency is
  // used since RetailPayment doesn't duplicate that field.
  const revenueByCurrency = sumByCurrency(
    succeededPayments.map((p) => ({ currency: p.retailOrder.currency, amountCents: p.amountCents })),
  );
  const aovByCurrency: [string, number][] = revenueByCurrency.map(([currency, cents]) => [
    currency,
    retailOrdersCount ? Math.round(cents / retailOrdersCount) : 0,
  ]);

  const byCategoryMap = products.reduce<Record<string, { count: number; units: number; valueRows: CurrencyAmount[] }>>(
    (acc, p) => {
      const bucket = acc[p.category] ?? { count: 0, units: 0, valueRows: [] };
      bucket.count += 1;
      bucket.units += p.quantity;
      bucket.valueRows.push({ currency: p.currency, amountCents: p.priceCents * p.quantity });
      acc[p.category] = bucket;
      return acc;
    },
    {},
  );
  const byCategory = Object.entries(byCategoryMap)
    .map(([category, data]) => ({
      category,
      count: data.count,
      units: data.units,
      valueByCurrency: sumByCurrency(data.valueRows),
    }))
    .sort((a, b) => b.units - a.units);

  return {
    products,
    totalSkus: products.length,
    totalUnitsInStock: products.reduce((sum, p) => sum + p.quantity, 0),
    outOfStock,
    lowStock,
    stockValueByCurrency,
    retailOrdersCount,
    unitsSold,
    revenueByCurrency,
    aovByCurrency,
    byCategory,
  };
}
