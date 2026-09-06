"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

/**
 * Redirects the browser to the payment provider's hosted checkout page.
 * This component never sets any "paid" state itself — it only requests a
 * checkout URL and navigates to it; the actual payment confirmation comes
 * later, exclusively from the server-verified webhook (see
 * src/app/api/webhooks/stripe/route.ts). A successful redirect back to this
 * app afterward is not treated as proof of payment anywhere in the app.
 */
export function CheckoutButton({ commissionId }: { commissionId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/commissions/${commissionId}/checkout`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not start checkout");
      setLoading(false);
      return;
    }
    const body = await res.json();
    window.location.href = body.checkoutUrl;
  }

  return (
    <div>
      <Button disabled={loading} onClick={startCheckout} className="w-full">
        {loading ? "Redirecting to payment…" : "Proceed to Payment"}
      </Button>
      {error && <p className="text-xs text-rust mt-2">{error}</p>}
    </div>
  );
}
