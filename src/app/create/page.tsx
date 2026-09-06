import type { Metadata } from "next";
import { db } from "@/lib/db";
import { StudioIntakeForm } from "@/components/studio/StudioIntakeForm";

export const metadata: Metadata = {
  title: "Custom Creation Studio",
  description: "Describe your story and receive original wearable-art creative directions.",
};

export default async function CreatePage() {
  const garments = await db.garment.findMany({ where: { active: true }, orderBy: { basePriceCents: "asc" } });

  return (
    <div className="container-editorial py-24">
      <p className="label-eyebrow text-rust mb-4">Custom Creation Studio</p>
      <h1 className="font-display text-5xl max-w-2xl mb-6">
        Tell us your story.
      </h1>
      <p className="max-w-xl text-ink/70 mb-16">
        Our AI Creative Director will read what you share and propose three
        distinct creative directions for a human artist to bring to life.
        Nothing here is final until you approve it.
      </p>
      <StudioIntakeForm garments={garments} />
    </div>
  );
}
