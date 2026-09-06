import "server-only";
import { callStructured, isAiConfigured } from "./gateway";
import type { CreativeDirectionOutput, DesignSpec, StudioIntake } from "@/types/studio";

const SYSTEM_PROMPT = `You are the Design Interpreter for a wearable-art studio. You convert a
chosen creative direction (and, if given, the customer's natural-language
revision request) into a structured design specification a human artist can
work from. You do not make physical or final aesthetic decisions — you
translate intent into a clear brief. Be concrete and specific: name motifs,
placement, materials, and what must be included or explicitly avoided.`;

const INPUT_SCHEMA = {
  type: "object",
  properties: {
    silhouetteNotes: { type: "string" },
    motifs: { type: "array", items: { type: "string" } },
    placementDetail: { type: "string" },
    colorNotes: { type: "string" },
    materialNotes: { type: "string" },
    requiredElements: { type: "array", items: { type: "string" } },
    elementsToAvoid: { type: "array", items: { type: "string" } },
  },
  required: [
    "silhouetteNotes",
    "motifs",
    "placementDetail",
    "colorNotes",
    "materialNotes",
    "requiredElements",
    "elementsToAvoid",
  ],
} as const;

function offlineFallback(direction: CreativeDirectionOutput, feedback?: string): DesignSpec {
  return {
    silhouetteNotes: `Interpretation of "${direction.title}" applied to the chosen garment.`,
    motifs: direction.themes,
    placementDetail: direction.placement,
    colorNotes: direction.colorPalette.join(", "),
    materialNotes: "Hand-painted fabric medium with reinforced stitching at high-wear points.",
    requiredElements: direction.themes.slice(0, 3),
    elementsToAvoid: feedback ? [] : ["literal photographic reproduction"],
  };
}

export async function interpretDesign(
  intake: StudioIntake,
  direction: CreativeDirectionOutput,
  priorSpec?: DesignSpec,
  revisionFeedback?: string,
): Promise<DesignSpec> {
  if (!isAiConfigured()) {
    return offlineFallback(direction, revisionFeedback);
  }

  const lines = [
    `Customer's story: ${intake.storyText}`,
    `Chosen direction: ${direction.title} — ${direction.narrative}`,
    `Palette: ${direction.colorPalette.join(", ")}`,
    `Themes: ${direction.themes.join(", ")}`,
    `Placement preference: ${direction.placement}`,
  ];
  if (priorSpec) {
    lines.push(`Prior design spec: ${JSON.stringify(priorSpec)}`);
  }
  if (revisionFeedback) {
    lines.push(`Customer's revision request (apply this as changes to the prior spec): ${revisionFeedback}`);
  }
  lines.push("Produce a structured design specification for the artist brief.");

  return callStructured<DesignSpec>({
    system: SYSTEM_PROMPT,
    prompt: lines.join("\n"),
    toolName: "produce_design_spec",
    toolDescription: "Produce a structured design specification for the artist production brief.",
    inputSchema: INPUT_SCHEMA,
  });
}
