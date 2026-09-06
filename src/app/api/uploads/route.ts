import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { requireSession, handleApiError, ApiError } from "@/lib/auth/guards";
import { checkRateLimit } from "@/lib/rateLimit";
import { detectImageExtension } from "@/lib/uploadSecurity";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

const LIMIT = 20;
const WINDOW_MS = 5 * 60 * 1000;

/**
 * Local-disk reference image uploads for MVP/dev. In production, swap this
 * for a real object store (S3-compatible bucket) — the response shape
 * (`{ url }`) is the only contract callers depend on, so the swap is
 * isolated to this file.
 */
export async function POST(request: Request) {
  try {
    const session = await requireSession();

    // Keyed by the now-known user id rather than IP — more precise, and
    // this endpoint requires auth anyway so the identity is already known.
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

    // Optional association with an existing commission, where the data
    // model already supports it (ReferenceImage/ProductionUpdate both key
    // on commissionId). Uploads made during Studio intake — before a
    // commission exists yet — have no id to pass and land in "unassigned",
    // exactly as before.
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

    const subDir = commissionId ?? "unassigned";
    const uploadsDir = path.join(process.cwd(), "public", "uploads", subDir);
    await mkdir(uploadsDir, { recursive: true });

    // Randomized filename only — the original filename is never read from
    // the upload or stored/echoed back anywhere.
    const filename = `${randomUUID()}.${ext}`;
    await writeFile(path.join(uploadsDir, filename), bytes);

    return NextResponse.json({ url: `/uploads/${subDir}/${filename}` });
  } catch (err) {
    return handleApiError(err);
  }
}
