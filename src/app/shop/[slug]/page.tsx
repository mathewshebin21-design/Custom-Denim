import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatPrice, discountPercent } from "@/lib/format";
import { AddToCartForm } from "@/components/shop/AddToCartForm";

const CONDITION_LABELS: Record<string, string> = {
  new: "New",
  like_new: "Like New",
  good: "Good",
  fair: "Fair",
};

async function loadProduct(slug: string) {
  const product = await db.product.findUnique({
    where: { slug },
    include: { images: { orderBy: { order: "asc" } } },
  });
  if (!product || !product.active) return null;
  return product;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await loadProduct(slug);
  return { title: product?.title ?? "Product" };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await loadProduct(slug);
  if (!product) notFound();

  return (
    <div className="container-editorial py-24 grid gap-12 lg:grid-cols-2">
      <div>
        <div className="aspect-[4/5] bg-paper-dim">
          {product.images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element -- storage-hosted product photo
            <img src={product.images[0].url} alt={product.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-ink/30 text-xs uppercase tracking-widest">
              No photo yet
            </div>
          )}
        </div>
        {/* Product videos are watched, not ambient background — controls
            rather than the autoplay/loop/mute convention used for the
            site's other, decorative footage. */}
        {product.videoUrl && (
          <video controls playsInline className="mt-4 w-full bg-paper-dim">
            <source src={product.videoUrl} type="video/mp4" />
          </video>
        )}
      </div>

      <div>
        <p className="label-eyebrow text-rust mb-2">
          {product.source === "thrifted_imported" ? "Thrifted / Imported" : "Surplus Branded Stock"}
        </p>
        {product.brand && <p className="label-eyebrow text-ink/50 mb-1">{product.brand}</p>}
        <h1 className="font-display text-4xl mb-4">{product.title}</h1>
        {product.compareAtPriceCents && product.compareAtPriceCents > product.priceCents ? (
          <div className="flex items-baseline gap-3 mb-6">
            <p className="text-2xl text-rust">{formatPrice(product.priceCents, product.currency)}</p>
            <p className="text-lg text-ink/40 line-through">
              {formatPrice(product.compareAtPriceCents, product.currency)}
            </p>
            <p className="label-eyebrow text-xs bg-rust text-paper px-2 py-1">
              {discountPercent(product.compareAtPriceCents, product.priceCents)}% Off
            </p>
          </div>
        ) : (
          <p className="text-2xl mb-6">{formatPrice(product.priceCents, product.currency)}</p>
        )}
        <p className="text-ink/70 mb-6 max-w-md">{product.description}</p>

        <dl className="text-sm text-ink/60 space-y-1 mb-8">
          {product.size && (
            <div className="flex gap-2">
              <dt className="w-24">Size</dt>
              <dd>{product.size}</dd>
            </div>
          )}
          <div className="flex gap-2">
            <dt className="w-24">Condition</dt>
            <dd>{CONDITION_LABELS[product.condition] ?? product.condition}</dd>
          </div>
        </dl>

        <AddToCartForm productId={product.id} maxQuantity={product.quantity} />
      </div>
    </div>
  );
}
