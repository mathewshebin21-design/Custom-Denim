import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Process",
  description: "How an AI-designed, artist-made one-of-one piece comes together.",
};

const STAGES = [
  { stage: "Artist Review", detail: "A human artist reviews your approved concept against the physical garment, confirming placement, scale, and technique." },
  { stage: "Base Preparation", detail: "The garment is prepped — washed, pressed, and marked for the work ahead." },
  { stage: "Sketch", detail: "The artist sketches the composition directly onto the garment or a working reference." },
  { stage: "Painting", detail: "Hand-painting begins, layer by layer, true to the approved concept." },
  { stage: "Detail Work", detail: "Embroidery, distressing, patches, or other physical embellishment is added by hand." },
  { stage: "Quality Control", detail: "The finished piece is checked for durability, fit, and fidelity to the brief." },
  { stage: "Packed", detail: "Your piece is packed for shipment, along with its Art Passport." },
  { stage: "Shipped", detail: "Your one-of-one piece is on its way to you." },
  { stage: "Delivered", detail: "It arrives — yours alone, documented, and one of one." },
];

export default function ProcessPage() {
  return (
    <div className="container-editorial py-24">
      <p className="label-eyebrow text-rust mb-4">Process</p>
      <h1 className="font-display text-5xl max-w-2xl mb-8">
        AI designs the direction. A human artist makes the piece.
      </h1>
      <p className="max-w-2xl text-ink/70 mb-20">
        Every commission moves through the same two phases: a creative
        studio session with AI, and a physical production process carried
        out entirely by hand by a human artist. Nothing is mass-produced,
        nothing is machine-made, and nothing ships until an artist has
        signed off on it.
      </p>

      <div className="grid gap-16 md:grid-cols-2 mb-24">
        <div>
          <p className="label-eyebrow text-denim mb-4">Phase One — The Studio</p>
          <h2 className="font-display text-2xl mb-4">From story to approved concept</h2>
          <ol className="space-y-4 text-sm text-ink/70 list-decimal list-inside">
            <li>You describe your story, references, garment, aesthetic, and budget.</li>
            <li>The AI Creative Director proposes three distinct creative directions.</li>
            <li>You choose one and refine it in plain language — every revision is saved, nothing is overwritten.</li>
            <li>You approve a final concept, which becomes a structured brief for the artist.</li>
          </ol>
        </div>
        <div>
          <p className="label-eyebrow text-rust mb-4">Phase Two — Production</p>
          <h2 className="font-display text-2xl mb-4">From brief to finished garment</h2>
          <p className="text-sm text-ink/70">
            A human artist is assigned based on style and capability. They
            review feasibility on the real garment, then carry the piece
            through every physical production stage below — with progress
            photos along the way.
          </p>
        </div>
      </div>

      <div>
        <p className="label-eyebrow text-ink/50 mb-8">Production Stages</p>
        <div className="grid gap-px bg-line md:grid-cols-3">
          {STAGES.map((s, i) => (
            <div key={s.stage} className="bg-paper p-6">
              <p className="font-display text-3xl text-rust/70 mb-3">{String(i + 1).padStart(2, "0")}</p>
              <p className="font-semibold mb-2">{s.stage}</p>
              <p className="text-sm text-ink/60">{s.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-24 border-t border-line pt-12 max-w-2xl">
        <h2 className="font-display text-2xl mb-4">A note on what AI does — and doesn&apos;t do</h2>
        <p className="text-sm text-ink/70">
          AI handles creative discovery, concept development, revision
          assistance, and briefing. It does not have final artistic
          judgment, does not physically make anything, and every concept
          image is a visualization, not a promise of the finished piece.
          Feasibility notes from the AI are advisory only — the human artist
          has the final word before anything is produced.
        </p>
      </div>
    </div>
  );
}
