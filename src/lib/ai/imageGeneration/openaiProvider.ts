import type { ConceptImageParams } from "./types";

/**
 * Real image-generation provider — calls OpenAI's Images API (gpt-image-1)
 * directly over `fetch` rather than pulling in the `openai` SDK for a
 * single endpoint. Only this file and `index.ts` (the swap point, see its
 * own header comment) know this is OpenAI-shaped; nothing else in the app
 * does.
 *
 * No `"server-only"` import — see `index.ts`'s header comment for why.
 */

const OPENAI_IMAGES_URL = "https://api.openai.com/v1/images/generations";
const DEFAULT_MODEL = "gpt-image-1";

export function isOpenAiImageConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

function buildPrompt(params: ConceptImageParams): string {
  const parts = [
    `A concept-art visualization for a hand-painted, artist-made ${params.garmentLabel.toLowerCase()} design titled "${params.title}".`,
    params.narrative,
    `Color palette: ${params.colorPalette.join(", ")}.`,
    `Visual themes and motifs: ${params.themes.join(", ")}.`,
  ];
  if (params.placement) parts.push(`Primary artwork placement on the garment: ${params.placement}.`);
  parts.push(
    "Style: an expressive, painterly editorial concept sketch or mood board — not a photorealistic product photo. This is a proposal for a human artist to interpret by hand, not the final piece, so it should read as a concept illustration, not a finished garment photo.",
  );
  return parts.join(" ");
}

/** Returns the generated image's raw bytes (always PNG for gpt-image-1). */
export async function generateOpenAiConceptImage(params: ConceptImageParams): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const response = await fetch(OPENAI_IMAGES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL || DEFAULT_MODEL,
      prompt: buildPrompt(params),
      size: "1024x1536",
      quality: "medium",
      n: 1,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`OpenAI image generation failed (${response.status}): ${detail.slice(0, 500)}`);
  }

  const json = (await response.json()) as { data?: Array<{ b64_json?: string }> };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI image generation returned no image data");
  return Buffer.from(b64, "base64");
}
