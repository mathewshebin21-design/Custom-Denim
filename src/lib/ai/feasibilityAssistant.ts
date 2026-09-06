import "server-only";
import { callStructured, isAiConfigured } from "./gateway";
import type { DesignSpec, FeasibilityAssessment } from "@/types/studio";

const SYSTEM_PROMPT = `You are the Feasibility Assistant for a wearable-art studio. You review a
design specification and flag likely physical-production considerations —
scale, placement on a garment, embroidery vs. paint tradeoffs, durability at
high-wear points — for a human artist to weigh in on.

Your output is ADVISORY ONLY. Never claim something is definitely feasible
or infeasible — the human artist makes that call during Artist Review. Frame
everything as considerations and suggested adjustments, not verdicts.`;

const INPUT_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    considerations: { type: "array", items: { type: "string" } },
    suggestedAdjustments: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "considerations", "suggestedAdjustments"],
} as const;

function offlineFallback(): FeasibilityAssessment {
  return {
    summary: "Advisory notes pending artist review — no automated feasibility check was run.",
    considerations: [
      "Placement and scale should be confirmed against the physical garment during Artist Review.",
    ],
    suggestedAdjustments: [],
  };
}

export async function assessFeasibility(
  garmentLabel: string,
  spec: DesignSpec,
): Promise<FeasibilityAssessment> {
  if (!isAiConfigured()) {
    return offlineFallback();
  }

  const prompt = [
    `Garment: ${garmentLabel}`,
    `Silhouette notes: ${spec.silhouetteNotes}`,
    `Motifs: ${spec.motifs.join(", ")}`,
    `Placement: ${spec.placementDetail}`,
    `Materials: ${spec.materialNotes}`,
    `Required elements: ${spec.requiredElements.join(", ")}`,
    "Provide advisory feasibility notes for the human artist, not a verdict.",
  ].join("\n");

  return callStructured<FeasibilityAssessment>({
    system: SYSTEM_PROMPT,
    prompt,
    toolName: "assess_feasibility",
    toolDescription: "Provide advisory, non-binding feasibility notes for the human artist to review.",
    inputSchema: INPUT_SCHEMA,
  });
}
