export function formatPrice(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

// Only meaningful when compareAtCents is actually higher than priceCents —
// callers check that themselves before showing a discount badge, since a
// stale or misconfigured compareAtPriceCents (equal to or below the real
// price) shouldn't render as "0% off" or a negative discount.
export function discountPercent(compareAtCents: number, priceCents: number): number {
  return Math.round(((compareAtCents - priceCents) / compareAtCents) * 100);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(d);
}
