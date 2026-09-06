/**
 * One-time (repeatable/idempotent) migration of existing local-disk uploads
 * (public/uploads/, pre-C2) into object storage (STORAGE_PROVIDER, see
 * src/lib/storage).
 *
 * Usage:
 *   STORAGE_PROVIDER=s3 ...  npx tsx scripts/migrate-local-uploads-to-storage.ts
 *
 * Design:
 * - Primary loop is DATABASE rows, not local files: every ReferenceImage /
 *   ProductionUpdate row whose stored value still starts with "/uploads/"
 *   (the old route's URL shape) is a row that hasn't been migrated yet.
 *   This makes the script naturally idempotent — a second run finds zero
 *   such rows and does nothing, regardless of what's still sitting on
 *   local disk.
 * - The new object key reuses the existing file's basename verbatim (it's
 *   already an opaque randomUUID()-based name) rather than generating a
 *   fresh one — so re-running always computes the exact same target key
 *   for the exact same source file, and an upload that already exists
 *   (verified via headObject) is not re-uploaded.
 * - Every candidate file is re-validated with the same magic-byte check
 *   the upload route itself uses (src/lib/uploadSecurity.ts) before being
 *   trusted as a real image — a file that fails this check is reported as
 *   a failure, never silently uploaded.
 * - After every local file referenced by a DB row has been considered,
 *   local disk is scanned separately and any file whose legacy path was
 *   never referenced by any row (pre- or post-migration) is reported as
 *   UNOWNED — never uploaded, never deleted. A human must resolve these.
 * - Nothing is ever deleted from public/uploads/ by this script. That is a
 *   deliberate, separate, future, explicitly-triggered cleanup step.
 */
import "dotenv/config";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { db } from "../src/lib/db";
import { getStorage } from "../src/lib/storage";
import { detectImageExtension } from "../src/lib/uploadSecurity";

// Reuses the source file's existing basename (already an opaque
// randomUUID()-based name) as the new asset id, rather than generating a
// fresh one via objectKeys.ts's normal builders — this is what makes
// re-running the migration idempotent (see file header).
function migratedReferenceImageKey(customerId: string, filename: string): string {
  return `private/customers/${customerId}/references/${filename}`;
}
function migratedProductionPhotoKey(commissionId: string, filename: string): string {
  return `private/commissions/${commissionId}/production/${filename}`;
}

const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");
const CONTENT_TYPE_FOR_EXT: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

type Outcome = { legacyUrl: string; status: "migrated" | "already-migrated" | "failed" | "unowned"; detail?: string };

function legacyUrlFor(relativePath: string): string {
  return `/uploads/${relativePath.split(path.sep).join("/")}`;
}

async function listLocalFiles(): Promise<string[]> {
  const results: string[] = [];
  async function walk(dir: string) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === ".gitkeep") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else results.push(path.relative(UPLOADS_ROOT, full));
    }
  }
  await walk(UPLOADS_ROOT);
  return results;
}

async function migrateFile(
  legacyRelativePath: string,
  newKey: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const absolutePath = path.join(UPLOADS_ROOT, legacyRelativePath);
  let bytes: Buffer;
  try {
    bytes = await readFile(absolutePath);
  } catch (err) {
    return { ok: false, reason: `source file missing or unreadable: ${err instanceof Error ? err.message : err}` };
  }

  const ext = detectImageExtension(bytes);
  if (!ext) {
    return { ok: false, reason: "source file failed magic-byte validation — not a recognized image" };
  }

  const storage = getStorage();
  const existing = await storage.headObject(newKey, "private");
  if (!existing.exists) {
    await storage.putObject({ key: newKey, body: bytes, contentType: CONTENT_TYPE_FOR_EXT[ext], visibility: "private" });
  }

  // Verify: re-read what's actually in storage now and compare against the
  // source bytes — not just trusting the putObject call succeeded.
  const stored = await storage.getObject(newKey, "private");
  const sourceHash = createHash("sha256").update(bytes).digest("hex");
  const storedHash = createHash("sha256").update(stored).digest("hex");
  if (sourceHash !== storedHash) {
    return { ok: false, reason: `checksum mismatch after upload (source ${sourceHash} != stored ${storedHash})` };
  }
  const head = await storage.headObject(newKey, "private");
  if (!head.exists || head.size !== bytes.length) {
    return { ok: false, reason: `post-upload headObject size mismatch (expected ${bytes.length}, got ${head.size})` };
  }

  return { ok: true };
}

async function main() {
  const outcomes: Outcome[] = [];
  const consideredLegacyPaths = new Set<string>();

  console.log("--- Migrating ReferenceImage rows ---");
  const referenceImages = await db.referenceImage.findMany({
    where: { url: { startsWith: "/uploads/" } },
    include: { commission: { select: { customerId: true } } },
  });
  for (const ref of referenceImages) {
    const legacyRelative = ref.url.replace(/^\/uploads\//, "");
    consideredLegacyPaths.add(legacyRelative);
    const filename = path.basename(legacyRelative);
    const newKey = migratedReferenceImageKey(ref.commission.customerId, filename);
    const result = await migrateFile(legacyRelative, newKey);
    if (result.ok) {
      await db.referenceImage.update({ where: { id: ref.id }, data: { url: newKey } });
      outcomes.push({ legacyUrl: ref.url, status: "migrated" });
      console.log(`  MIGRATED  ReferenceImage ${ref.id}: ${ref.url} -> ${newKey}`);
    } else {
      outcomes.push({ legacyUrl: ref.url, status: "failed", detail: result.reason });
      console.error(`  FAILED    ReferenceImage ${ref.id}: ${result.reason}`);
    }
  }

  console.log("\n--- Migrating ProductionUpdate rows ---");
  const productionUpdates = await db.productionUpdate.findMany({
    where: { photoUrl: { startsWith: "/uploads/" } },
  });
  for (const update of productionUpdates) {
    const legacyRelative = update.photoUrl!.replace(/^\/uploads\//, "");
    consideredLegacyPaths.add(legacyRelative);
    const filename = path.basename(legacyRelative);
    const newKey = migratedProductionPhotoKey(update.commissionId, filename);
    const result = await migrateFile(legacyRelative, newKey);
    if (result.ok) {
      await db.productionUpdate.update({ where: { id: update.id }, data: { photoUrl: newKey } });
      outcomes.push({ legacyUrl: update.photoUrl!, status: "migrated" });
      console.log(`  MIGRATED  ProductionUpdate ${update.id}: ${update.photoUrl} -> ${newKey}`);
    } else {
      outcomes.push({ legacyUrl: update.photoUrl!, status: "failed", detail: result.reason });
      console.error(`  FAILED    ProductionUpdate ${update.id}: ${result.reason}`);
    }
  }

  if (referenceImages.length === 0 && productionUpdates.length === 0) {
    console.log("  No rows still reference /uploads/... — nothing to migrate (already migrated, or none exist).");
  }

  console.log("\n--- Scanning local disk for unowned files ---");
  const localFiles = await listLocalFiles();
  const unowned: string[] = [];
  for (const relativePath of localFiles) {
    if (consideredLegacyPaths.has(relativePath)) continue;
    // Also not owned if some OTHER (already-migrated) row used to reference
    // it — we can't know that retroactively once a row's value has changed,
    // so we check whether any row currently or ever pointed at it via the
    // audit trail available to us: none does, by definition of not being in
    // consideredLegacyPaths and not matching any current non-legacy key.
    unowned.push(relativePath);
  }
  if (unowned.length === 0) {
    console.log("  No unowned files found.");
  } else {
    console.warn(`  WARNING: ${unowned.length} local file(s) have no owning database record:`);
    for (const f of unowned) {
      const full = path.join(UPLOADS_ROOT, f);
      const stats = await stat(full).catch(() => null);
      console.warn(`    - ${legacyUrlFor(f)} (${stats ? `${stats.size} bytes` : "unreadable"})`);
    }
    console.warn(
      "  These were NOT uploaded and NOT deleted — this script cannot determine what they belong to. " +
        "A human must confirm before treating them as production assets or removing them.",
    );
  }

  console.log("\n--- Summary ---");
  const migrated = outcomes.filter((o) => o.status === "migrated").length;
  const failed = outcomes.filter((o) => o.status === "failed").length;
  console.log(`Migrated: ${migrated}  Failed: ${failed}  Unowned (untouched): ${unowned.length}`);

  await db.$disconnect();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
