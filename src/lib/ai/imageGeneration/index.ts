import { getStorage } from "@/lib/storage";
import { conceptImageKey } from "@/lib/storage/objectKeys";
import type { ConceptImageParams } from "./types";
import { generatePlaceholderConceptImage } from "./placeholderProvider";
import { generateOpenAiConceptImage, isOpenAiImageConfigured } from "./openaiProvider";

export type { ConceptImageParams };

/**
 * No `"server-only"` import here, matching `src/lib/storage/`'s existing
 * precedent (itself matching `src/lib/db.ts`): this module is imported both
 * from Next (Server Actions/API routes) and directly via tsx
 * (`prisma/seed.ts`) — `"server-only"` unconditionally throws outside a
 * bundler that understands the "react-server" export condition, which
 * plain Node/tsx does not.
 *
 * Every caller depends only on `generateConceptImage`'s signature — this is
 * the module's swap point (mirrors `gateway.ts`'s `isAiConfigured` pattern
 * for the text-generation side). Without `OPENAI_API_KEY` set, every call
 * silently and correctly falls back to the placeholder SVG, exactly like
 * the Creative Director does without `ANTHROPIC_API_KEY` — so the whole
 * Studio flow keeps working for demos/tests with zero AI credentials.
 *
 * The placeholder path returns a `data:` URI directly (unchanged from
 * before this module existed). The real-provider path uploads the
 * generated PNG to storage as a PUBLIC object and returns its stable URL.
 * Public, not private: the exact same image is already rendered on public
 * pages (the Art gallery, homepage, and a piece's Art Passport, via
 * `Artwork.approvedVersion.imageUrl`) as well as the customer's own
 * Studio/account views — there is no private/public split to preserve here,
 * since concept images have never had any access control to begin with
 * (they were previously an inline SVG data URI baked directly into
 * server-rendered HTML, reachable by anyone who could load that HTML).
 */
export async function generateConceptImage(params: ConceptImageParams): Promise<string> {
  if (!isOpenAiImageConfigured()) {
    return generatePlaceholderConceptImage(params);
  }

  try {
    const bytes = await generateOpenAiConceptImage(params);
    const storage = getStorage();
    const key = conceptImageKey("png");
    await storage.putObject({ key, body: bytes, contentType: "image/png", visibility: "public" });
    return storage.getPublicUrl(key);
  } catch (err) {
    // Never let a flaky or misconfigured image API break the Studio flow —
    // the placeholder concept card is always a safe, working fallback.
    // Logged, not swallowed silently.
    console.error("[imageGeneration] OpenAI concept image generation failed, falling back to placeholder:", err);
    return generatePlaceholderConceptImage(params);
  }
}
