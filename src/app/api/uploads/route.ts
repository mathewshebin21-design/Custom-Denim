import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { requireSession, handleApiError } from "@/lib/auth/guards";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/**
 * Local-disk reference image uploads for MVP/dev. In production, swap this
 * for a real object store (S3-compatible bucket) — the response shape
 * (`{ url }`) is the only contract callers depend on, so the swap is
 * isolated to this file.
 */
export async function POST(request: Request) {
  try {
    await requireSession();
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    const ext = ALLOWED_TYPES[file.type];
    if (!ext) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 8MB)" }, { status: 400 });
    }

    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });
    const filename = `${randomUUID()}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(uploadsDir, filename), bytes);

    return NextResponse.json({ url: `/uploads/${filename}` });
  } catch (err) {
    return handleApiError(err);
  }
}
