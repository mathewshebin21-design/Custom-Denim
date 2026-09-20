import { randomUUID } from "node:crypto";

/**
 * Deterministic object-key builders. Every key starts with its visibility
 * ("public"/"private") so the two provider implementations can route to the
 * right bucket/directory from the key alone, and every segment is an opaque
 * database id (cuid) or a generated asset id — never customer text, an
 * email, or anything else that could leak information through the key
 * itself.
 *
 * Three kinds of asset are covered: reference images and production update
 * photos (both private — only the owning customer and admin ever see
 * them), and AI-generated concept images (public — see `conceptImageKey`
 * below for why). The `passports/`/`garments/` prefixes remain reserved,
 * documented conventions for the still-future Blender/R3F work — not
 * implemented here, so that phase doesn't need a new storage architecture,
 * only a new key builder following the same pattern.
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

/** AI-generated concept visualization images (see
 * `src/lib/ai/imageGeneration/`). Public, not namespaced by
 * commission/customer: the same image is already displayed on public pages
 * (Art gallery, homepage, a piece's Art Passport) as well as the owning
 * customer's private Studio/account views, so there's no private/public
 * split to preserve — this asset type has never had real access control
 * (previously an inline SVG data URI baked into server-rendered HTML). The
 * asset id alone (a random UUID) is what keeps unguessed/unapproved
 * concept images practically unreachable, same as today. */
export function conceptImageKey(ext: string): string {
  return `public/concepts/${assetId(ext)}`;
}

/** Retail shop product photos — public, namespaced by productId. */
export function productImageKey(productId: string, ext: string): string {
  return `public/products/${productId}/${assetId(ext)}`;
}

// Reserved for future phases (not implemented yet):
//   public/passports/{passportId}/{assetId}            — published Art Passport photos
//   public/garments/{garmentId}/models/{assetId}.glb    — Blender-authored GLB assets
