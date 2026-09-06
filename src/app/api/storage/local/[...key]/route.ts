import { NextResponse } from "next/server";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { verifyLocalSignedUrl } from "@/lib/storage/localProvider";

/**
 * Dev-only local-storage file server (LocalStorageProvider's counterpart to
 * an S3 bucket). Not used in production — STORAGE_PROVIDER=s3 there, so
 * this route is never exercised, but it's still guarded defensively.
 *
 * A key's own first segment ("public" or "private") is the visibility rule
 * — see objectKeys.ts. "public/..." serves unconditionally; "private/..."
 * requires a valid, unexpired `exp`+`sig` query pair (see
 * localProvider.ts's HMAC signing), exactly mirroring how a real S3 bucket
 * pair (a public bucket + presigned URLs for a private one) behaves.
 */

const STORAGE_ROOT = path.join(process.cwd(), ".local-storage");
const CONTENT_TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

export async function GET(request: Request, ctx: RouteContext<"/api/storage/local/[...key]">) {
  if (process.env.STORAGE_PROVIDER !== "local") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { key: segments } = await ctx.params;
  const key = segments.join("/");

  const resolved = path.resolve(STORAGE_ROOT, key);
  if (!resolved.startsWith(STORAGE_ROOT + path.sep)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (key.startsWith("private/")) {
    const url = new URL(request.url);
    const exp = Number(url.searchParams.get("exp"));
    const sig = url.searchParams.get("sig");
    if (!exp || !sig || !verifyLocalSignedUrl(key, exp, sig)) {
      return NextResponse.json({ error: "This link has expired or is invalid" }, { status: 403 });
    }
  } else if (!key.startsWith("public/")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await stat(resolved);
    const bytes = await readFile(resolved);
    const ext = key.split(".").pop() ?? "";
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
        "Cache-Control": key.startsWith("public/") ? "public, max-age=31536000, immutable" : "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
