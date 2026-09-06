import type { StorageService, StorageVisibility } from "./types";
import { LocalStorageProvider } from "./localProvider";
import { S3StorageProvider, loadS3ConfigFromEnv } from "./s3Provider";

export type { StorageService, StorageVisibility, PutObjectParams, HeadObjectResult } from "./types";
export { referenceImageKey, productionPhotoKey } from "./objectKeys";

let instance: StorageService | null = null;

/**
 * The one place that knows storage providers exist. Everything else in the
 * app depends only on the `StorageService` interface — no caller branches
 * on `STORAGE_PROVIDER` itself.
 *
 * Deliberately requires `STORAGE_PROVIDER` to be set explicitly rather than
 * silently defaulting (same discipline C1 applied to DATABASE_URL) — and
 * deliberately does NOT derive storage provider/credentials from APP_ENV,
 * so a misconfigured deployment can't accidentally point at the wrong
 * bucket just because APP_ENV happened to be set a certain way.
 */
export function getStorage(): StorageService {
  if (instance) return instance;

  const provider = process.env.STORAGE_PROVIDER;
  if (!provider) {
    throw new Error('STORAGE_PROVIDER is not set. Set it to "local" or "s3" — see .env.example.');
  }
  if (provider === "local") {
    instance = new LocalStorageProvider();
  } else if (provider === "s3") {
    instance = new S3StorageProvider(loadS3ConfigFromEnv());
  } else {
    throw new Error(`Unknown STORAGE_PROVIDER "${provider}" — must be "local" or "s3".`);
  }
  return instance;
}

/**
 * Resolves a value stored in a database `url`/`photoUrl`-style column into a
 * URL the browser can actually load, at render time — never persisted.
 *
 * Handles three shapes for safety/back-compat, though only the first is
 * expected to occur going forward:
 * - a storage object key (e.g. "private/customers/.../x.png") → resolved to
 *   a fresh signed URL (private) or the stable public URL (public)
 * - a legacy "/uploads/..." path from before C2 → returned as-is (no
 *   currently-existing database row uses this shape, confirmed by direct
 *   inspection before this migration, but this keeps the resolver honest
 *   about not assuming that forever)
 * - a "data:" URI (e.g. the deterministic SVG concept generator's inline
 *   output) → returned as-is; this never touched storage and still doesn't
 */
export async function resolveAssetUrl(value: string | null): Promise<string | null> {
  if (!value) return null;
  if (value.startsWith("data:") || value.startsWith("/uploads/") || value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }
  const visibility: StorageVisibility = value.startsWith("public/") ? "public" : "private";
  return getStorage().getSignedUrl(value, visibility);
}
