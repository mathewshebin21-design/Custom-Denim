"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TagInput } from "@/components/studio/TagInput";
import { ReferenceUploader } from "@/components/studio/ReferenceUploader";
import { formatPrice } from "@/lib/format";

type Garment = { id: string; type: string; label: string; description: string; basePriceCents: number };

const BUDGET_TIERS = [
  { label: "Essential", cents: 30000 },
  { label: "Signature", cents: 45000 },
  { label: "Statement", cents: 65000 },
  { label: "Museum-grade", cents: 90000 },
];

export function StudioIntakeForm({ garments }: { garments: Garment[] }) {
  const router = useRouter();
  const [garmentId, setGarmentId] = useState(garments[0]?.id ?? "");
  const [storyText, setStoryText] = useState("");
  const [aestheticText, setAestheticText] = useState("");
  const [themes, setThemes] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [placement, setPlacement] = useState("");
  const [occasion, setOccasion] = useState("");
  const [budgetTierCents, setBudgetTierCents] = useState<number | undefined>(BUDGET_TIERS[1].cents);
  const [referenceImageUrls, setReferenceImageUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/commissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        garmentId,
        storyText,
        aestheticText: aestheticText || undefined,
        themes,
        colors,
        placement: placement || undefined,
        occasion: occasion || undefined,
        budgetTierCents,
        referenceImageUrls,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong");
      return;
    }
    const body = await res.json();
    router.push(`/create/${body.commission.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-10">
      <div>
        <label className="label-eyebrow block mb-3 text-ink/60">Garment</label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {garments.map((g) => (
            <button
              type="button"
              key={g.id}
              onClick={() => setGarmentId(g.id)}
              className={`border p-4 text-left text-sm transition-colors ${
                garmentId === g.id ? "border-ink bg-ink text-paper" : "border-line hover:border-rust"
              }`}
            >
              <p className="font-semibold">{g.label}</p>
              <p className={`text-xs mt-1 ${garmentId === g.id ? "text-paper/70" : "text-ink/50"}`}>
                From {formatPrice(g.basePriceCents)}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label-eyebrow block mb-2 text-ink/60">Your Story</label>
        <p className="text-xs text-ink/50 mb-2">
          Tell us about a memory, a place, a person, a feeling — whatever
          this piece should carry. There&apos;s no wrong way to say it.
        </p>
        <textarea
          required
          minLength={20}
          rows={6}
          value={storyText}
          onChange={(e) => setStoryText(e.target.value)}
          placeholder="I grew up spending summers at my grandmother's house on the coast..."
          className="w-full border border-line bg-transparent px-4 py-3 text-sm outline-none focus:border-rust"
        />
      </div>

      <div>
        <label className="label-eyebrow block mb-2 text-ink/60">Aesthetic (optional)</label>
        <textarea
          rows={3}
          value={aestheticText}
          onChange={(e) => setAestheticText(e.target.value)}
          placeholder="Moody and cinematic. Or: bright, painterly, a little chaotic."
          className="w-full border border-line bg-transparent px-4 py-3 text-sm outline-none focus:border-rust"
        />
      </div>

      <div className="grid gap-8 sm:grid-cols-2">
        <TagInput
          label="Themes / interests"
          placeholder="e.g. the ocean, jazz, film noir — press Enter"
          value={themes}
          onChange={setThemes}
        />
        <TagInput
          label="Color preferences"
          placeholder="e.g. indigo, rust, bone white — press Enter"
          value={colors}
          onChange={setColors}
        />
      </div>

      <div className="grid gap-8 sm:grid-cols-2">
        <div>
          <label className="label-eyebrow block mb-2 text-ink/60">Placement (optional)</label>
          <input
            value={placement}
            onChange={(e) => setPlacement(e.target.value)}
            placeholder="e.g. full back panel"
            className="w-full border border-line bg-transparent px-4 py-3 text-sm outline-none focus:border-rust"
          />
        </div>
        <div>
          <label className="label-eyebrow block mb-2 text-ink/60">Occasion (optional)</label>
          <input
            value={occasion}
            onChange={(e) => setOccasion(e.target.value)}
            placeholder="e.g. a gift, an anniversary"
            className="w-full border border-line bg-transparent px-4 py-3 text-sm outline-none focus:border-rust"
          />
        </div>
      </div>

      <div>
        <label className="label-eyebrow block mb-3 text-ink/60">Budget</label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {BUDGET_TIERS.map((tier) => (
            <button
              type="button"
              key={tier.cents}
              onClick={() => setBudgetTierCents(tier.cents)}
              className={`border p-4 text-left text-sm transition-colors ${
                budgetTierCents === tier.cents ? "border-ink bg-ink text-paper" : "border-line hover:border-rust"
              }`}
            >
              <p className="font-semibold">{tier.label}</p>
              <p className={`text-xs mt-1 ${budgetTierCents === tier.cents ? "text-paper/70" : "text-ink/50"}`}>
                {formatPrice(tier.cents)}
              </p>
            </button>
          ))}
        </div>
      </div>

      <ReferenceUploader urls={referenceImageUrls} onChange={setReferenceImageUrls} />

      {error && <p className="text-sm text-rust">{error}</p>}

      <Button type="submit" disabled={loading || !garmentId}>
        {loading ? "Generating your directions…" : "Generate Creative Directions"}
      </Button>
    </form>
  );
}
