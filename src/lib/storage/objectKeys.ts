import { randomUUID } from "node:crypto";

/**
 * Deterministic object-key builders. Every key starts with its visibility
 * ("public"/"private") so the two provider implementations can route to the
 * right bucket/directory from the key alone, and every segment is an opaque
 * database id (cuid) or a generated asset id — never customer text, an
 * email, or anything else that could leak information through the key
 * itself.
 *
 * Only the two kinds of asset the application actually uploads today are
 * covered (reference images, production update photos). The prefixes below
 * (concepts/, passports/, garments/) are reserved, documented conventions
 * for the frozen future Blender/R3F/Art-Passport work — not implemented
 * here, so future phases don't need a new storage architecture, only new
 * key builders following the same pattern.
 */

function assetId(ext: string): string {
  return `${randomUUID()}.${ext}`;
}

/** Studio reference images. Keyed by the uploading customer, since a
 * pre-commission upload (Studio intake) has no commissionId yet — the
 * session's user id is the only stable identifier available at upload
 * time. The owning ReferenceImage.commissionId row is the actual
 * authorization source of truth; this key path is just storage layout. */
export function referenceImageKey(customerId: string, ext: string): string {
  return `private/customers/${customerId}/references/${assetId(ext)}`;
}

/** Admin production-update photos. Always has a commissionId (production
 * updates only happen on an existing commission). */
export function productionPhotoKey(commissionId: string, ext: string): string {
  return `private/commissions/${commissionId}/production/${assetId(ext)}`;
}

// Reserved for future phases (not implemented in C2):
//   public/passports/{passportId}/{assetId}            — published Art Passport photos
//   private/concepts/{conceptId}/versions/{versionId}/artwork/{assetId} — future AI/hybrid concept renders
//   public/garments/{garmentId}/models/{assetId}.glb    — Blender-authored GLB assets
