/**
 * Provider-agnostic object storage contract. Nothing outside this directory
 * should know whether objects live on local disk or in an S3-compatible
 * bucket — every caller depends only on this interface (see index.ts's
 * `getStorage()` factory, which picks the implementation via
 * `STORAGE_PROVIDER`).
 *
 * Kept deliberately small: only the operations the application actually
 * needs today (upload, resolve a browser-usable URL, delete, check
 * existence, read bytes back for verification) — no copy/move, no
 * multipart/streaming upload, no bucket-management calls. Add methods here
 * only when a real caller needs them.
 */

export type StorageVisibility = "public" | "private";

export interface PutObjectParams {
  key: string;
  body: Buffer;
  contentType: string;
  visibility: StorageVisibility;
}

export interface HeadObjectResult {
  exists: boolean;
  size?: number;
  contentType?: string;
}

export interface StorageService {
  /** Uploads an object. `key` must already be a fully-formed, namespaced
   * key (see `objectKeys.ts`) — this method does not invent or sanitize
   * keys itself. */
  putObject(params: PutObjectParams): Promise<{ key: string }>;

  /** A short-lived URL for browser access to a PRIVATE object. Never
   * persist this value — persist the `key` and call this again at render
   * time, since the URL expires. */
  getSignedUrl(key: string, visibility: StorageVisibility, expiresInSeconds?: number): Promise<string>;

  /** A stable, non-expiring URL for a PUBLIC object. Only meaningful for
   * objects uploaded with `visibility: "public"`. */
  getPublicUrl(key: string): string;

  /** Reads an object's bytes back. Used for post-upload verification
   * (size/content/checksum), not part of any normal request path. */
  getObject(key: string, visibility: StorageVisibility): Promise<Buffer>;

  headObject(key: string, visibility: StorageVisibility): Promise<HeadObjectResult>;

  deleteObject(key: string, visibility: StorageVisibility): Promise<void>;
}

/**
 * Structured event names for future observability (C0's "StorageService as
 * an eventual observability chokepoint"). Not wired to any logging/metrics
 * backend in C2 — `emitStorageEvent` below is a single, deliberately narrow
 * seam so that wiring can be added later without touching call sites.
 */
export type StorageEventName =
  | "storage.upload.started"
  | "storage.upload.completed"
  | "storage.upload.failed"
  | "storage.delete.completed"
  | "storage.signed_url.generated";

export type StorageEvent = {
  name: StorageEventName;
  key: string;
  visibility?: StorageVisibility;
  provider: string;
  /** Never include object bytes, credentials, or full signed URLs here. */
  detail?: Record<string, string | number | boolean>;
};

export function emitStorageEvent(event: StorageEvent): void {
  // Deliberately minimal: structured console output today, swappable for a
  // real metrics/logging sink later without changing any call site, since
  // every call already goes through this one function.
  console.log(`[storage] ${event.name}`, {
    key: event.key,
    visibility: event.visibility,
    provider: event.provider,
    ...event.detail,
  });
}
