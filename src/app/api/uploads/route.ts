import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, handleApiError, ApiError } from "@/lib/auth/guards";
import { checkRateLimit } from "@/lib/rateLimit";
import { detectImageExtension } from "@/lib/uploadSecurity";
import { getStorage, referenceImageKey, productionPhotoKey } from "@/lib/storage";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const CONTENT_TYPE_FOR_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

const LIMIT = 20;
const WINDOW_MS = 5 * 60 * 1000;

/**
 * Reference-image / production-photo uploads, backed by object storage
 * (see src/lib/storage). Both current asset kinds are PRIVATE (customer
 * reference uploads and production photos are never public — see
 * src/lib/storage/objectKeys.ts), so this route always uploads with
 * visibility: "private" and returns a short-lived signed URL for immediate
 * client-side preview alongside the stable `key` callers must persist.
 *
 * Order is deliberately: authenticate -> rate limit (by the now-known user
 * id, more precise than by IP) -> validate -> authorize (commission
 * ownership) -> upload. This is the same order Phase A established; C2
 * only swaps what happens at the final step.
 */
export async function POST(request: Request) {
  try {
    const session = await requireSession();

    const rate = await checkRateLimit("uploads", session.id, LIMIT, WINDOW_MS);
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

    // The declared Content-Type/extension is only a fast pre-filter above —
    // this is the check that actually matters. A file whose bytes don't
    // match a real PNG/JPEG/WEBP signature is rejected outright, regardless
    // of what the browser claimed it was.
    const ext = detectImageExtension(bytes);
    if (!ext) {
      return NextResponse.json(
        { error: "File content doesn't match a supported image format" },
        { status: 400 },
      );
    }

    // Optional association with an existing commission. Uploads made
    // during Studio intake — before a commission exists yet — have no id
    // to pass and are keyed by the uploading customer instead.
    const commissionIdRaw = formData.get("commissionId");
    const commissionId = typeof commissionIdRaw === "string" && commissionIdRaw.length > 0 ? commissionIdRaw : null;
    if (commissionId) {
      const commission = await db.commission.findUnique({
        where: { id: commissionId },
        select: { customerId: true },
      });
      if (!commission) throw new ApiError(404, "Commission not found");
      if (commission.customerId !== session.id && session.role !== "admin") {
        throw new ApiError(403, "Not your commission");
      }
    }

    const key = commissionId ? productionPhotoKey(commissionId, ext) : referenceImageKey(session.id, ext);
    const storage = getStorage();
    await storage.putObject({
      key,
      body: bytes,
      contentType: CONTENT_TYPE_FOR_EXT[ext],
      visibility: "private",
    });

    // `url` is for immediate client-side preview only (see
    // ReferenceUploader.tsx) — it is a short-lived signed URL and must
    // never be the value persisted to the database. `key` is the stable
    // value callers should submit onward (into referenceImageUrls /
    // photoUrl), to be re-resolved to a fresh signed URL at render time.
    const url = await storage.getSignedUrl(key, "private");
    return NextResponse.json({ key, url });
  } catch (err) {
    return handleApiError(err);
  }
}
