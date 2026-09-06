"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function ReviewForm({ commissionId }: { commissionId: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/commissions/${commissionId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, text: text || undefined }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong");
      return;
    }
    setSubmitted(true);
    router.refresh();
  }

  if (submitted) {
    return <p className="text-sm text-ink/70">Thank you for your review.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-4">
      <div>
        <label className="label-eyebrow block mb-2 text-ink/60">Rating</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              type="button"
              key={n}
              onClick={() => setRating(n)}
              className={`h-9 w-9 border text-sm ${rating >= n ? "border-ink bg-ink text-paper" : "border-line"}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <textarea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Tell us about your experience (optional)"
        className="w-full border border-line bg-transparent px-4 py-3 text-sm outline-none focus:border-rust"
      />
      {error && <p className="text-sm text-rust">{error}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? "Submitting…" : "Submit Review"}
      </Button>
    </form>
  );
}
