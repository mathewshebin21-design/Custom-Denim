import "server-only";
import { callStructured, isAiConfigured } from "./gateway";
import type { CreativeDirectorOutput, StudioIntake } from "@/types/studio";

const SYSTEM_PROMPT = `You are the Creative Director for a premium wearable-art studio. Customers
describe a personal story, memory, or aesthetic, and you translate it into
original, wearable-art concepts for a human artist to eventually paint,
embroider, or otherwise physically create by hand.

You are NOT the artist. You never claim to paint, sew, or physically make
anything yourself — you interpret and direct. Final artistic judgment and all
physical craftsmanship belong to a human artist who reviews every concept
before production begins.

Always propose exactly 3 distinct creative directions. Each direction must:
- have a short, evocative, all-caps title (2-4 words, e.g. "MEMORY ARCHIVE")
- explain in 2-4 sentences why this direction honors the customer's story
- specify a color palette of 3-6 colors (as descriptive names or hex-ish
  swatches, e.g. "faded indigo", "rust orange")
- list 3-6 visual themes/motifs
- suggest a garment placement for the primary artwork

The 3 directions must feel genuinely different from each other in mood and
visual language, not 3 minor variations of the same idea.

If the story references real, identifiable third-party brands, characters,
or copyrighted artwork, do not reproduce them directly — instead note the
inspiration abstractly and flag it, since final legal/feasibility review
happens with the human artist.`;

const INPUT_SCHEMA = {
  type: "object",
  properties: {
    directions: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          narrative: { type: "string" },
          colorPalette: { type: "array", items: { type: "string" } },
          themes: { type: "array", items: { type: "string" } },
          placement: { type: "string" },
        },
        required: ["title", "narrative", "colorPalette", "themes", "placement"],
      },
    },
  },
  required: ["directions"],
} as const;

function buildPrompt(intake: StudioIntake): string {
  const lines = [
    `Garment: ${intake.garmentLabel}`,
    `Customer's story: ${intake.storyText}`,
  ];
  if (intake.aestheticText) lines.push(`Preferred aesthetic: ${intake.aestheticText}`);
  if (intake.themes.length) lines.push(`Themes/interests they mentioned: ${intake.themes.join(", ")}`);
  if (intake.colors.length) lines.push(`Color preferences: ${intake.colors.join(", ")}`);
  if (intake.placement) lines.push(`Placement preference: ${intake.placement}`);
  if (intake.occasion) lines.push(`Occasion: ${intake.occasion}`);
  if (intake.referenceImageNotes?.length) {
    lines.push(`Reference images provided (described): ${intake.referenceImageNotes.join("; ")}`);
  }
  lines.push("Propose 3 distinct creative directions per your instructions.");
  return lines.join("\n");
}

function truncateAtWord(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  return `${truncated.slice(0, lastSpace > 0 ? lastSpace : maxLength)}…`;
}

function offlineFallback(intake: StudioIntake): CreativeDirectorOutput {
  const baseThemes = intake.themes.length ? intake.themes : ["personal story", "texture", "memory"];
  const baseColors = intake.colors.length ? intake.colors : ["indigo", "bone white", "rust"];
  return {
    directions: [
      {
        title: "MEMORY ARCHIVE",
        narrative: `A documentary approach that arranges fragments of your story — ${truncateAtWord(intake.storyText, 120)} — like pages in a personal archive, stitched and layered rather than illustrated literally.`,
        colorPalette: baseColors,
        themes: baseThemes,
        placement: intake.placement || "full back panel",
      },
      {
        title: "CINEMATIC NOIR",
        narrative: "A moodier, high-contrast treatment that dramatizes your story through shadow, silhouette, and a restrained palette — closer to a film still than a literal scene.",
        colorPalette: ["ink black", "smoke grey", "single accent"],
        themes: [...baseThemes.slice(0, 2), "contrast", "silhouette"],
        placement: intake.placement || "back yoke and sleeve",
      },
      {
        title: "RAW STREET ART",
        narrative: "An energetic, hand-painted treatment with visible brushwork and layered mark-making, closer to a mural than a portrait — built for movement and everyday wear.",
        colorPalette: [...baseColors.slice(0, 2), "spray-can accent"],
        themes: [...baseThemes.slice(0, 2), "texture", "spontaneity"],
        placement: intake.placement || "front and back panels",
      },
    ],
  };
}

export async function generateCreativeDirections(intake: StudioIntake): Promise<CreativeDirectorOutput> {
  if (!isAiConfigured()) {
    return offlineFallback(intake);
  }
  return callStructured<CreativeDirectorOutput>({
    system: SYSTEM_PROMPT,
    prompt: buildPrompt(intake),
    toolName: "propose_creative_directions",
    toolDescription: "Propose exactly 3 distinct wearable-art creative directions for this customer's commission.",
    inputSchema: INPUT_SCHEMA,
  });
}
