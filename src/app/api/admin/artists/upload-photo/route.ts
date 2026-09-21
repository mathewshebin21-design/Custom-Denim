import { NextResponse } from "next/server";
import { requireAdmin, handleApiError } from "@/lib/auth/guards";
import { checkRateLimit } from "@/lib/rateLimit";
import { detectImageExtension } from "@/lib/uploadSecurity";
import { getStorage, artistPhotoKey } from "@/lib/storage";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const CONTENT_TYPE_FOR_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

const LIMIT = 40;
const WINDOW_MS = 5 * 60 * 1000;

/** Admin-only artist photo upload — same shape as
 * src/app/api/admin/products/upload/route.ts (public, shop-facing, magic-
 * bytes checked rather than trusting the declared Content-Type). */
export async function POST(request: Request) {
  try {
    const session = await requireAdmin();

    const rate = await checkRateLimit("admin-artist-uploads", session.id, LIMIT, WINDOW_MS);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many uploads. Please try again later." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 8MB)" }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const ext = detectImageExtension(bytes);
    if (!ext) {
      return NextResponse.json({ error: "File content doesn't match a supported image format" }, { status: 400 });
    }

    const artistIdRaw = formData.get("artistId");
    const artistId = typeof artistIdRaw === "string" && artistIdRaw.length > 0 ? artistIdRaw : "unassigned";

    const key = artistPhotoKey(artistId, ext);
    const storage = getStorage();
    await storage.putObject({ key, body: bytes, contentType: CONTENT_TYPE_FOR_EXT[ext], visibility: "public" });

    return NextResponse.json({ url: storage.getPublicUrl(key) });
  } catch (err) {
    return handleApiError(err);
  }
}
