import { NextResponse } from "next/server";
import { requireAdmin, handleApiError } from "@/lib/auth/guards";
import { checkRateLimit } from "@/lib/rateLimit";
import { detectVideoExtension } from "@/lib/uploadSecurity";
import { getStorage, productVideoKey } from "@/lib/storage";

const MAX_BYTES = 40 * 1024 * 1024; // 40MB — a short product clip, not a movie
const ALLOWED_TYPES = new Set(["video/mp4", "video/quicktime"]);

const LIMIT = 20;
const WINDOW_MS = 5 * 60 * 1000;

/**
 * Admin-only product video upload — same shape as
 * src/app/api/admin/products/upload/route.ts (photos), one file per
 * request, public (shop-facing) storage. A product has at most one video,
 * set directly on Product.videoUrl rather than a gallery table like
 * ProductImage, so there's no separate "attach" step here: the caller PATCHes
 * the returned URL onto the product itself.
 */
export async function POST(request: Request) {
  try {
    const session = await requireAdmin();

    const rate = await checkRateLimit("admin-product-video-uploads", session.id, LIMIT, WINDOW_MS);
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
      return NextResponse.json({ error: "Unsupported file type — use MP4" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 40MB)" }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const ext = detectVideoExtension(bytes);
    if (!ext) {
      return NextResponse.json({ error: "File content doesn't match a supported video format" }, { status: 400 });
    }

    const productIdRaw = formData.get("productId");
    const productId = typeof productIdRaw === "string" && productIdRaw.length > 0 ? productIdRaw : "unassigned";

    const key = productVideoKey(productId, ext);
    const storage = getStorage();
    await storage.putObject({ key, body: bytes, contentType: "video/mp4", visibility: "public" });

    return NextResponse.json({ url: storage.getPublicUrl(key) });
  } catch (err) {
    return handleApiError(err);
  }
}
