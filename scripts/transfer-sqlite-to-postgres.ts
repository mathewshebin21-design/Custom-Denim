/**
 * One-time (repeatable) data transfer from a legacy SQLite database into the
 * current PostgreSQL database.
 *
 * Usage:
 *   SOURCE_SQLITE_URL="file:./prisma/dev.db" npx tsx scripts/transfer-sqlite-to-postgres.ts
 *
 * The target is always the normal `DATABASE_URL` (same PostgreSQL connection
 * the app itself uses) — the source is a separate env var so the two can
 * never be confused with each other.
 *
 * Design:
 * - Reads the SQLite file directly via the raw @libsql/client driver (not
 *   through Prisma) — since prisma/schema.prisma is now PostgreSQL-only, the
 *   generated Prisma Client can no longer talk to SQLite at all, and
 *   maintaining a second full Prisma schema+client just for this one-time
 *   script would be more complexity than the problem needs.
 * - Writes through the app's real Prisma Client (`db`, PostgreSQL), using
 *   `upsert` keyed on `id` for every model, so re-running this script is
 *   always safe (never produces duplicate rows).
 * - Walks models in foreign-key-safe order (parents before children) so a
 *   child row's foreign key always already exists when it's inserted.
 * - Never deletes or modifies the source SQLite file.
 * - Reports a per-model before-count (source) / after-count (target) so the
 *   transfer's completeness can be verified, not assumed.
 * - Flags — but does not silently resolve — any User row whose email isn't
 *   one of the known seed accounts. This script does not decide what counts
 *   as "real" customer data; a human must read that warning and confirm
 *   before treating a transferred database as production-ready.
 */
import "dotenv/config";
import { createClient as createLibsqlClient } from "@libsql/client";
import { db } from "../src/lib/db";

const KNOWN_SEED_EMAILS = new Set([
  "admin@customdenim.studio",
  "maya@customdenim.studio",
  "theo@customdenim.studio",
  "priya@customdenim.studio",
  "demo.customer@customdenim.studio",
]);

type Row = Record<string, unknown>;

function toBool(value: unknown): boolean {
  return value === 1 || value === true || value === "1";
}

function toDateOrNull(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  return new Date(value as string);
}

function toDate(value: unknown): Date {
  return new Date(value as string);
}

type TableSpec = {
  table: string;
  booleanFields?: string[];
  requiredDateFields?: string[];
  nullableDateFields?: string[];
  transform?: (row: Row) => Row;
  upsert: (row: Row) => Promise<unknown>;
};

async function fetchRows(sqlite: ReturnType<typeof createLibsqlClient>, table: string): Promise<Row[]> {
  const result = await sqlite.execute(`SELECT * FROM "${table}"`);
  return result.rows.map((row) => {
    const obj: Row = {};
    result.columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

function applyFieldConversions(row: Row, spec: TableSpec): Row {
  const out: Row = { ...row };
  for (const field of spec.booleanFields ?? []) {
    out[field] = toBool(out[field]);
  }
  for (const field of spec.requiredDateFields ?? []) {
    out[field] = toDate(out[field]);
  }
  for (const field of spec.nullableDateFields ?? []) {
    out[field] = toDateOrNull(out[field]);
  }
  return spec.transform ? spec.transform(out) : out;
}

async function transferTable(
  sqlite: ReturnType<typeof createLibsqlClient>,
  spec: TableSpec,
): Promise<{ table: string; sourceCount: number; transferred: number; failed: number }> {
  const rows = await fetchRows(sqlite, spec.table);
  let transferred = 0;
  let failed = 0;
  for (const rawRow of rows) {
    try {
      const row = applyFieldConversions(rawRow, spec);
      await spec.upsert(row);
      transferred++;
    } catch (err) {
      failed++;
      console.error(
        `  FAILED ${spec.table} id=${String(rawRow.id)}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  return { table: spec.table, sourceCount: rows.length, transferred, failed };
}

async function main() {
  const sourceUrl = process.env.SOURCE_SQLITE_URL;
  if (!sourceUrl) {
    console.error("Set SOURCE_SQLITE_URL to the legacy SQLite file, e.g. file:./prisma/dev.db");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL (the PostgreSQL target) is not set.");
    process.exit(1);
  }

  const sqlite = createLibsqlClient({ url: sourceUrl });

  const specs: TableSpec[] = [
    {
      table: "User",
      requiredDateFields: ["createdAt", "updatedAt"],
      upsert: (row) =>
        db.user.upsert({
          where: { id: row.id as string },
          create: row as never,
          update: row as never,
        }),
    },
    {
      table: "CustomerProfile",
      requiredDateFields: ["createdAt", "updatedAt"],
      upsert: (row) =>
        db.customerProfile.upsert({ where: { id: row.id as string }, create: row as never, update: row as never }),
    },
    {
      table: "Garment",
      booleanFields: ["active"],
      requiredDateFields: ["createdAt", "updatedAt"],
      upsert: (row) => db.garment.upsert({ where: { id: row.id as string }, create: row as never, update: row as never }),
    },
    {
      table: "Artist",
      requiredDateFields: ["createdAt", "updatedAt"],
      upsert: (row) => db.artist.upsert({ where: { id: row.id as string }, create: row as never, update: row as never }),
    },
    {
      table: "Commission",
      requiredDateFields: ["createdAt", "updatedAt"],
      upsert: (row) =>
        db.commission.upsert({ where: { id: row.id as string }, create: row as never, update: row as never }),
    },
    {
      table: "ReferenceImage",
      requiredDateFields: ["uploadedAt"],
      upsert: (row) =>
        db.referenceImage.upsert({ where: { id: row.id as string }, create: row as never, update: row as never }),
    },
    {
      table: "Concept",
      requiredDateFields: ["createdAt", "updatedAt"],
      upsert: (row) => db.concept.upsert({ where: { id: row.id as string }, create: row as never, update: row as never }),
    },
    {
      table: "CreativeDirection",
      booleanFields: ["isSelected"],
      requiredDateFields: ["createdAt"],
      upsert: (row) =>
        db.creativeDirection.upsert({ where: { id: row.id as string }, create: row as never, update: row as never }),
    },
    {
      table: "ConceptVersion",
      requiredDateFields: ["createdAt"],
      upsert: (row) =>
        db.conceptVersion.upsert({ where: { id: row.id as string }, create: row as never, update: row as never }),
    },
    {
      table: "ArtistAssignment",
      requiredDateFields: ["assignedAt"],
      upsert: (row) =>
        db.artistAssignment.upsert({ where: { id: row.id as string }, create: row as never, update: row as never }),
    },
    {
      table: "ProductionStage",
      requiredDateFields: ["enteredAt"],
      nullableDateFields: ["exitedAt"],
      upsert: (row) =>
        db.productionStage.upsert({ where: { id: row.id as string }, create: row as never, update: row as never }),
    },
    {
      table: "ProductionUpdate",
      requiredDateFields: ["createdAt"],
      upsert: (row) =>
        db.productionUpdate.upsert({ where: { id: row.id as string }, create: row as never, update: row as never }),
    },
    {
      table: "Artwork",
      requiredDateFields: ["createdAt", "updatedAt"],
      nullableDateFields: ["completedAt"],
      upsert: (row) => db.artwork.upsert({ where: { id: row.id as string }, create: row as never, update: row as never }),
    },
    {
      table: "ArtPassport",
      requiredDateFields: ["createdAt"],
      nullableDateFields: ["publishedAt"],
      upsert: (row) =>
        db.artPassport.upsert({ where: { id: row.id as string }, create: row as never, update: row as never }),
    },
    {
      table: "Order",
      requiredDateFields: ["createdAt", "updatedAt"],
      upsert: (row) => db.order.upsert({ where: { id: row.id as string }, create: row as never, update: row as never }),
    },
    {
      table: "Payment",
      requiredDateFields: ["createdAt"],
      nullableDateFields: ["paidAt"],
      upsert: (row) => db.payment.upsert({ where: { id: row.id as string }, create: row as never, update: row as never }),
    },
    {
      table: "Shipment",
      nullableDateFields: ["shippedAt", "deliveredAt"],
      upsert: (row) =>
        db.shipment.upsert({ where: { id: row.id as string }, create: row as never, update: row as never }),
    },
    {
      table: "Review",
      requiredDateFields: ["createdAt"],
      upsert: (row) => db.review.upsert({ where: { id: row.id as string }, create: row as never, update: row as never }),
    },
  ];

  console.log(`Transferring from ${sourceUrl} -> PostgreSQL (${process.env.DATABASE_URL?.replace(/:[^:@]*@/, ":***@")})\n`);

  const results = [];
  for (const spec of specs) {
    const result = await transferTable(sqlite, spec);
    results.push(result);
    console.log(
      `${result.table.padEnd(20)} source=${result.sourceCount}  transferred=${result.transferred}  failed=${result.failed}`,
    );
  }

  console.log("\n--- Post-transfer verification (source vs. target counts) ---");
  let anyMismatch = false;
  for (const spec of specs) {
    const targetCount = await (db[(spec.table.charAt(0).toLowerCase() + spec.table.slice(1)) as keyof typeof db] as {
      count: () => Promise<number>;
    }).count();
    const sourceResult = results.find((r) => r.table === spec.table)!;
    const match = targetCount >= sourceResult.sourceCount ? "OK" : "MISMATCH";
    if (match === "MISMATCH") anyMismatch = true;
    console.log(`${spec.table.padEnd(20)} source=${sourceResult.sourceCount}  target(total)=${targetCount}  ${match}`);
  }

  console.log("\n--- Real-data vs. seed/test-data check (User rows) ---");
  const allUsers = await db.user.findMany({ select: { email: true } });
  const unexpected = allUsers.map((u) => u.email).filter((email) => !KNOWN_SEED_EMAILS.has(email));
  if (unexpected.length > 0) {
    console.warn(
      `WARNING: ${unexpected.length} user account(s) in the target database do not match any known seed account:`,
    );
    for (const email of unexpected) console.warn(`  - ${email}`);
    console.warn(
      "These were present in the source SQLite database as-is. This script cannot determine whether they " +
        "represent real customers or leftover test/QA data — do not treat them as production-ready without " +
        "manual confirmation.",
    );
  } else {
    console.log("All User rows match known seed accounts — no ambiguous accounts found.");
  }

  sqlite.close();
  await db.$disconnect();

  if (anyMismatch) {
    console.error("\nTransfer completed with count mismatches — see MISMATCH rows above.");
    process.exit(1);
  }
  console.log("\nTransfer complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
