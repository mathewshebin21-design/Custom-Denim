"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { formatPrice, discountPercent } from "@/lib/format";

type ProductImage = { id: string; url: string };
type Product = {
  id: string;
  title: string;
  slug: string;
  category: string;
  brand: string | null;
  description: string;
  size: string | null;
  condition: string;
  source: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  currency: string;
  quantity: number;
  active: boolean;
  images: ProductImage[];
  videoUrl: string | null;
};

const CATEGORIES = [
  { value: "shirts", label: "Shirts" },
  { value: "t_shirts", label: "T-Shirts" },
  { value: "denim", label: "Jeans" },
  { value: "cargos", label: "Cargos & Chinos" },
  { value: "shoes", label: "Shoes" },
  { value: "activewear", label: "Activewear" },
  { value: "denim_jackets", label: "Denim Jackets" },
  { value: "jackets", label: "Jackets" },
];
const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));
const CONDITIONS = ["new", "like_new", "good", "fair"];
const SOURCES = ["surplus_branded", "thrifted_imported"];
const CURRENCIES = ["inr", "usd", "eur", "gbp"];

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Full CRUD surface for the retail catalog: create, inline price/stock/active
 * edits, per-product photo upload, delete. All state is server-confirmed —
 * every action refetches or replaces from the API response, no speculative
 * local-only edits, since stale admin state here directly drives what
 * customers see and can buy in the Shop.
 */
export function AdminProductManager({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = useState(initialProducts);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    category: CATEGORIES[0].value,
    brand: "",
    description: "",
    size: "",
    condition: "good",
    source: "surplus_branded",
    price: "",
    compareAtPrice: "",
    currency: "inr",
    quantity: "1",
  });
  const [creating, setCreating] = useState(false);

  async function createProduct() {
    setError(null);
    const priceCents = Math.round(Number(form.price) * 100);
    if (!form.title.trim() || !priceCents || priceCents < 1) {
      setError("Title and a valid price are required.");
      return;
    }
    setCreating(true);
    const res = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        slug: slugify(form.title),
        category: form.category,
        brand: form.brand || undefined,
        description: form.description || form.title,
        size: form.size || undefined,
        condition: form.condition,
        source: form.source,
        priceCents,
        compareAtPriceCents: form.compareAtPrice ? Math.round(Number(form.compareAtPrice) * 100) : undefined,
        currency: form.currency,
        quantity: Number(form.quantity) || 1,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Could not create product");
    } else {
      setProducts((prev) => [body.product, ...prev]);
      setForm({ ...form, title: "", brand: "", description: "", size: "", price: "", compareAtPrice: "", quantity: "1" });
    }
    setCreating(false);
  }

  async function patchProduct(id: string, data: Record<string, unknown>) {
    setError(null);
    const res = await fetch(`/api/admin/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Could not update product");
      return;
    }
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...body.product } : p)));
  }

  async function deleteProduct(id: string) {
    if (!confirm("Delete this product? This cannot be undone.")) return;
    const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
    if (res.ok) setProducts((prev) => prev.filter((p) => p.id !== id));
  }

  async function uploadImage(productId: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("productId", productId);
    const uploadRes = await fetch("/api/admin/products/upload", { method: "POST", body: formData });
    const uploadBody = await uploadRes.json().catch(() => ({}));
    if (!uploadRes.ok) {
      setError(uploadBody.error ?? "Could not upload image");
      return;
    }
    const attachRes = await fetch(`/api/admin/products/${productId}/images`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: uploadBody.url }),
    });
    const attachBody = await attachRes.json().catch(() => ({}));
    if (!attachRes.ok) {
      setError(attachBody.error ?? "Could not attach image");
      return;
    }
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, images: [...p.images, attachBody.image] } : p)),
    );
  }

  async function uploadVideo(productId: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("productId", productId);
    const uploadRes = await fetch("/api/admin/products/upload-video", { method: "POST", body: formData });
    const uploadBody = await uploadRes.json().catch(() => ({}));
    if (!uploadRes.ok) {
      setError(uploadBody.error ?? "Could not upload video");
      return;
    }
    await patchProduct(productId, { videoUrl: uploadBody.url });
  }

  return (
    <div>
      {error && <p className="text-sm text-rust mb-6">{error}</p>}

      <div className="border border-line p-6 mb-12">
        <p className="label-eyebrow mb-4">Add a Product</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <input
            placeholder="Title (e.g. Jack & Jones Jeans)"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="border border-line px-3 py-2 text-sm"
          />
          <input
            placeholder="Brand"
            value={form.brand}
            onChange={(e) => setForm({ ...form, brand: e.target.value })}
            className="border border-line px-3 py-2 text-sm"
          />
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="border border-line px-3 py-2 text-sm bg-paper"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            value={form.source}
            onChange={(e) => setForm({ ...form, source: e.target.value })}
            className="border border-line px-3 py-2 text-sm bg-paper"
          >
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <select
            value={form.condition}
            onChange={(e) => setForm({ ...form, condition: e.target.value })}
            className="border border-line px-3 py-2 text-sm bg-paper"
          >
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {c.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <input
            placeholder="Size"
            value={form.size}
            onChange={(e) => setForm({ ...form, size: e.target.value })}
            className="border border-line px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <input
              placeholder="Price"
              type="number"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="border border-line px-3 py-2 text-sm flex-1 min-w-0"
            />
            <select
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              className="border border-line px-2 py-2 text-sm bg-paper"
              title="Currency"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <input
            placeholder="Quantity"
            type="number"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            className="border border-line px-3 py-2 text-sm"
          />
          <input
            placeholder="Original price (optional — for a discount)"
            type="number"
            value={form.compareAtPrice}
            onChange={(e) => setForm({ ...form, compareAtPrice: e.target.value })}
            className="border border-line px-3 py-2 text-sm"
            title="Set higher than Price to show it struck through as a discount"
          />
          <textarea
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="border border-line px-3 py-2 text-sm sm:col-span-2 lg:col-span-3"
            rows={2}
          />
        </div>
        <Button disabled={creating} onClick={createProduct} className="mt-4">
          {creating ? "Adding…" : "Add Product"}
        </Button>
      </div>

      <div className="divide-y divide-line border-t border-b border-line">
        {products.map((product) => (
          <div key={product.id} className="flex items-center gap-4 py-4">
            <div className="h-16 w-14 bg-paper-dim flex-shrink-0 relative overflow-hidden">
              {product.images[0] && (
                <Image src={product.images[0].url} alt={product.title} fill sizes="56px" className="object-cover" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{product.title}</p>
              <p className="text-xs text-ink/50">
                {product.brand ?? "—"} · {CATEGORY_LABELS[product.category] ?? product.category.replace(/_/g, " ")} ·{" "}
                {product.source.replace(/_/g, " ")}
              </p>
            </div>
            <input
              type="number"
              defaultValue={product.priceCents / 100}
              onBlur={(e) => patchProduct(product.id, { priceCents: Math.round(Number(e.target.value) * 100) })}
              className="w-24 border border-line px-2 py-1.5 text-sm"
              title="Price"
            />
            <input
              type="number"
              defaultValue={product.compareAtPriceCents ? product.compareAtPriceCents / 100 : ""}
              placeholder="Was"
              onBlur={(e) => {
                const raw = e.target.value.trim();
                patchProduct(product.id, { compareAtPriceCents: raw ? Math.round(Number(raw) * 100) : null });
              }}
              className="w-20 border border-line px-2 py-1.5 text-sm"
              title="Original price — set to show a discount, clear to remove it"
            />
            <select
              defaultValue={product.currency}
              onChange={(e) => patchProduct(product.id, { currency: e.target.value })}
              className="border border-line px-1.5 py-1.5 text-sm bg-paper"
              title="Currency"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c.toUpperCase()}
                </option>
              ))}
            </select>
            <input
              type="number"
              defaultValue={product.quantity}
              onBlur={(e) => patchProduct(product.id, { quantity: Number(e.target.value) })}
              className="w-16 border border-line px-2 py-1.5 text-sm"
              title="Quantity"
            />
            <label className="flex items-center gap-1 text-xs text-ink/60">
              <input
                type="checkbox"
                checked={product.active}
                onChange={(e) => patchProduct(product.id, { active: e.target.checked })}
              />
              Active
            </label>
            <label className="text-xs text-ink/50 hover:text-rust cursor-pointer uppercase tracking-widest">
              Photo
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadImage(product.id, file);
                  e.target.value = "";
                }}
              />
            </label>
            <label
              className={`text-xs cursor-pointer uppercase tracking-widest ${product.videoUrl ? "text-rust" : "text-ink/50 hover:text-rust"}`}
              title={product.videoUrl ? "Video attached — click to replace" : "Attach a video"}
            >
              Video
              <input
                type="file"
                accept="video/mp4,video/quicktime"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadVideo(product.id, file);
                  e.target.value = "";
                }}
              />
            </label>
            <button
              onClick={() => deleteProduct(product.id)}
              className="text-xs text-ink/50 hover:text-rust uppercase tracking-widest"
            >
              Delete
            </button>
            <div className="w-24 text-right">
              {product.compareAtPriceCents && product.compareAtPriceCents > product.priceCents ? (
                <>
                  <p className="text-xs text-ink/40 line-through">
                    {formatPrice(product.compareAtPriceCents, product.currency)}
                  </p>
                  <p className="text-sm text-rust">
                    {formatPrice(product.priceCents, product.currency)}
                    <span className="ml-1 text-[10px] uppercase tracking-widest">
                      {discountPercent(product.compareAtPriceCents, product.priceCents)}% off
                    </span>
                  </p>
                </>
              ) : (
                <p className="text-sm text-ink/60">{formatPrice(product.priceCents, product.currency)}</p>
              )}
            </div>
          </div>
        ))}
        {products.length === 0 && <p className="py-12 text-center text-ink/50">No products yet.</p>}
      </div>
    </div>
  );
}
