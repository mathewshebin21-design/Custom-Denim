import "server-only";
import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODEL = "claude-sonnet-5";

let client: Anthropic | null = null;

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

/**
 * Calls Claude with a single forced tool call so the response is a
 * structured JSON object matching `inputSchema`, rather than free text we'd
 * have to parse. Every AI service in this app goes through this helper so
 * prompt/model changes stay centralized.
 */
export async function callStructured<T>(params: {
  system: string;
  prompt: string;
  toolName: string;
  toolDescription: string;
  inputSchema: Record<string, unknown>;
}): Promise<T> {
  const anthropic = getClient();
  const response = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
    max_tokens: 4096,
    system: params.system,
    messages: [{ role: "user", content: params.prompt }],
    tools: [
      {
        name: params.toolName,
        description: params.toolDescription,
        input_schema: params.inputSchema as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: params.toolName },
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return a structured tool response");
  }
  return toolUse.input as T;
}
