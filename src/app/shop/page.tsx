import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { formatPrice, discountPercent } from "@/lib/format";

export const metadata: Metadata = {
  title: "Shop",
  description: "Surplus branded stock and handpicked thrifted imported jackets.",
};

const CATEGORIES: { value: string; label: string }[] = [
  { value: "shirts", label: "Shirts" },
  { value: "t_shirts", label: "T-Shirts" },
  { value: "jeans", label: "Jeans" },
  { value: "cargos", label: "Cargos & Chinos" },
  { value: "shoes", label: "Shoes" },
  { value: "activewear", label: "Activewear" },
  { value: "denim_jackets", label: "Denim Jackets" },
  { value: "jackets", label: "Jackets" },
];
const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const showCustomTile = !category || category === "jackets";

  const products = await db.product.findMany({
    where: {
      active: true,
      ...(category ? { category } : {}),
    },
    include: { images: { orderBy: { order: "asc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      {/* Real footage — a walkthrough of the actual Ease Wear store, not a
          stock/AI clip — autoplaying muted/looped as a hero banner. Ends on
          the "eW EASE WEAR" sign, which sits in the top third of the source
          frame; object-position: top (rather than the default center) keeps
          object-cover's crop entirely below the sign on wide viewports
          instead of slicing through it, while still centering horizontally
          when a narrow/portrait viewport crops the sides instead. */}
      <div className="relative h-[70vh] max-h-[720px] w-full overflow-hidden bg-paper-dim">
        <video
          src="/video/shop-store-walkthrough.mp4"
          poster="/video/shop-store-walkthrough-poster.jpg"
          autoPlay
          muted
          loop
          playsInline
          className="h-full w-full object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-paper via-transparent to-transparent" />
      </div>

      <div className="container-editorial py-24">
        <p className="label-eyebrow text-rust mb-4">Ease Wear / Shop</p>
        <h1 className="font-display text-5xl max-w-2xl mb-6">Surplus finds. Thrifted one-offs.</h1>
        <p className="max-w-xl text-ink/70 mb-10">
          Branded overstock and handpicked pre-loved imported jackets — each in
          limited quantity, first come first served. Looking for a bespoke
          painted piece instead?{" "}
          <Link href="/create" className="underline hover:text-rust">
            Start a custom commission.
          </Link>
        </p>

        <div className="flex flex-wrap gap-2 mb-12">
          <Link
            href="/shop"
            className={`label-eyebrow text-xs border px-3 py-1.5 ${!category ? "border-ink bg-ink text-paper" : "border-line hover:border-rust hover:text-rust"}`}
          >
            All
          </Link>
          {CATEGORIES.map((c) => (
            <Link
              key={c.value}
              href={`/shop?category=${c.value}`}
              className={`label-eyebrow text-xs border px-3 py-1.5 ${category === c.value ? "border-ink bg-ink text-paper" : "border-line hover:border-rust hover:text-rust"}`}
            >
              {c.label}
            </Link>
          ))}
        </div>

        {products.length === 0 && !showCustomTile ? (
          <div className="border border-dashed border-line py-20 text-center">
            <p className="font-display text-xl mb-2">Nothing here yet.</p>
            <p className="text-sm text-ink/60">Check back soon — stock updates regularly.</p>
          </div>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {showCustomTile && (
              <Link href="/create" className="group block">
                <div className="aspect-[4/5] bg-paper-dim mb-3 overflow-hidden relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local static asset, same reasoning as SiteHeader.tsx */}
                  <img
                    src="/jackets/denim-jacket-ad-denim-with-character.webp"
                    alt="Hand-painted custom denim jacket"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <span className="absolute top-3 left-3 label-eyebrow text-[10px] bg-rust text-paper px-2 py-1">
                    Bespoke
                  </span>
                </div>
                <p className="label-eyebrow text-ink/50 text-[10px] mb-1">Custom Jackets</p>
                <p className="font-display text-lg leading-tight">Hand-Painted Denim Jacket</p>
                <p className="text-sm text-ink/70 mt-1">Starting at {formatPrice(2100000, "inr")}</p>
              </Link>
            )}
            {products.map((product) => (
              <Link key={product.id} href={`/shop/${product.slug}`} className="group block">
                <div className="aspect-[4/5] bg-paper-dim mb-3 overflow-hidden relative">
                  {product.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- remote/storage-hosted product photos, not a local static asset next/image can optimize without extra config
                    <img
                      src={product.images[0].url}
                      alt={product.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-ink/30 text-xs uppercase tracking-widest">
                      No photo yet
                    </div>
                  )}
                  {product.compareAtPriceCents && product.compareAtPriceCents > product.priceCents && (
                    <span className="absolute top-3 left-3 label-eyebrow text-[10px] bg-rust text-paper px-2 py-1">
                      {discountPercent(product.compareAtPriceCents, product.priceCents)}% Off
                    </span>
                  )}
                </div>
                <p className="label-eyebrow text-ink/50 text-[10px] mb-1">
                  {product.brand ?? CATEGORY_LABELS[product.category] ?? product.category}
                </p>
                <p className="font-display text-lg leading-tight">{product.title}</p>
                <div className="flex items-center justify-between mt-1">
                  {product.compareAtPriceCents && product.compareAtPriceCents > product.priceCents ? (
                    <p className="text-sm">
                      <span className="text-ink/40 line-through mr-2">
                        {formatPrice(product.compareAtPriceCents, product.currency)}
                      </span>
                      <span className="text-rust">{formatPrice(product.priceCents, product.currency)}</span>
                    </p>
                  ) : (
                    <p className="text-sm text-ink/70">{formatPrice(product.priceCents, product.currency)}</p>
                  )}
                  {product.quantity <= 2 && product.quantity > 0 && (
                    <p className="text-[10px] uppercase tracking-widest text-rust">Only {product.quantity} left</p>
                  )}
                  {product.quantity === 0 && (
                    <p className="text-[10px] uppercase tracking-widest text-ink/40">Sold out</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
