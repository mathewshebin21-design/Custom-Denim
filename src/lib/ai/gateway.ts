import "server-only";
import { GoogleGenAI, FunctionCallingConfigMode, ApiError } from "@google/genai";

// See the matching comment in adminAssistant.ts: pinned rather than
// "-latest" to avoid riding a newly-launched model's demand spike.
const DEFAULT_MODEL = "gemini-3.5-flash";

// Retried status codes: 503 (model temporarily overloaded) and 429 (rate
// limited) are both transient by nature — confirmed hitting 503 repeatedly
// against the live API while wiring this up, on requests that succeeded a
// moment later with no change on our end. Every other status (400 bad
// request, 401/403 auth, ...) is a real problem retrying can't fix, so it
// fails immediately instead of masking it behind three slow attempts.
const RETRYABLE_STATUS = new Set([429, 503]);
const RETRY_DELAYS_MS = [500, 1500];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let client: GoogleGenAI | null = null;

export function isAiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

function getClient(): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return client;
}

/**
 * Calls Gemini with a single forced function call so the response is a
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
  const ai = getClient();

  for (let attempt = 0; ; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
        contents: params.prompt,
        config: {
          systemInstruction: params.system,
          maxOutputTokens: 4096,
          tools: [
            {
              functionDeclarations: [
                {
                  name: params.toolName,
                  description: params.toolDescription,
                  parametersJsonSchema: params.inputSchema,
                },
              ],
            },
          ],
          toolConfig: {
            functionCallingConfig: {
              mode: FunctionCallingConfigMode.ANY,
              allowedFunctionNames: [params.toolName],
            },
          },
        },
      });

      const call = response.functionCalls?.[0];
      if (!call?.args) {
        throw new Error("Gemini did not return a structured function call response");
      }
      return call.args as T;
    } catch (err) {
      const retryable = err instanceof ApiError && RETRYABLE_STATUS.has(err.status);
      if (!retryable || attempt >= RETRY_DELAYS_MS.length) throw err;
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
}
