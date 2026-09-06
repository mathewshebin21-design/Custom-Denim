# Custom Denim — Wear Your Story

An AI-designed, artist-made, one-of-one wearable-art platform. Customers
describe a personal story in the **Custom Creation Studio**; an AI Creative
Director proposes distinct creative directions; the customer refines and
approves one; a human artist takes it from there — sketching, painting,
embroidering, and finishing every piece by hand. AI never touches the
garment. Every completed piece ships with a digital **Art Passport**.

This is a Phase 1 MVP (per the product brief) plus enough of Phase 2/3 to
demonstrate the full loop end-to-end: intake → AI concept generation →
versioned revisions → approval → artist assignment → production tracking →
Art Passport with QR verification.

## Stack

- **Next.js 16** (App Router, Turbopack) + TypeScript + Tailwind CSS v4
- **Prisma 7** ORM on **PostgreSQL** (via the `@prisma/adapter-pg` driver
  adapter) for every environment — see [Database](#database) for local setup
- **Hand-rolled session auth** (bcrypt + signed JWT cookies via `jose`) —
  chosen over NextAuth to avoid an unstable dependency on a framework this
  new; see [Why not NextAuth](#why-not-nextauth)
- **Anthropic Claude** (`@anthropic-ai/sdk`) for the AI Creative
  Director / Design Interpreter / Feasibility Assistant, called via forced
  tool-use for structured JSON output
- **QR codes** (`qrcode`) for Art Passport verification links
- **Object storage** (`src/lib/storage/`) for reference images and
  production photos, behind a provider-agnostic `StorageService` — local
  disk in dev, any S3-compatible bucket in production — see
  [Object storage](#object-storage)

## Getting started

Requires a local PostgreSQL database — see [Database](#database) for the
two supported ways to get one running (native or Docker).

```bash
npm install
cp .env.example .env   # then edit DATABASE_URL to point at your local Postgres
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

Open http://localhost:3000.

### Demo accounts (seeded)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@customdenim.studio` | `ChangeMe123!` |
| Artist | `maya@customdenim.studio` / `theo@customdenim.studio` / `priya@customdenim.studio` | `ChangeMe123!` |
| Demo customer | `demo.customer@customdenim.studio` | `ChangeMe123!` |

The seed script also creates one **fully completed commission** (jacket,
"Raw Street Art" direction, delivered, with a published Art Passport) so the
homepage and `/art` gallery aren't empty on first run. Everything else
(garments, admin, artists) is idempotent — re-running `prisma db seed` is
safe.

**Change `ChangeMe123!` and rotate `AUTH_SECRET` before deploying anywhere
real.** These are dev-only defaults, not production credentials.

### Environment variables

All in `.env` (see `.env.example` for the annotated template):

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string (`postgresql://user:password@host:port/db?schema=public`) — one per environment, never shared between dev/staging/production |
| `AUTH_SECRET` | yes | Signs session JWTs. Generate with `openssl rand -base64 32` |
| `ANTHROPIC_API_KEY` | no | Powers the real AI Creative Director / Design Interpreter / Feasibility Assistant. **Without it, the Studio runs in a clearly-labeled offline fallback mode** — deterministic, hand-written creative directions so the whole flow (including versioning, revisions, approval) still works for demos and testing without a key |
| `ANTHROPIC_MODEL` | no | Overrides the Claude model ID (defaults to `claude-sonnet-5`) |
| `APP_BASE_URL` | yes | Used to build the Art Passport's QR-code URL |
| `APP_ENV` | yes | `development`, `staging`, or `production`. `prisma/seed.ts` refuses to run unless this is `development` or `staging` — see below |
| `STORAGE_PROVIDER` | yes | `local` or `s3` — see [Object storage](#object-storage). Independent of `APP_ENV`; never inferred from it |
| `S3_*` | only if `STORAGE_PROVIDER=s3` | Region/endpoint/credentials/bucket names — see `.env.example` and [Object storage](#object-storage) |

### Running the AI for real

Set `ANTHROPIC_API_KEY` in `.env` and restart the dev server. No other
change is needed — `src/lib/ai/gateway.ts` checks for the key at call time
and every AI service (`creativeDirector.ts`, `designInterpreter.ts`,
`feasibilityAssistant.ts`) has an offline fallback for when it's absent.

## Architecture

### Data model (`prisma/schema.prisma`)

Full entity set from the product spec: `User` / `CustomerProfile` /
`Commission` / `Garment` / `Concept` / `CreativeDirection` /
`ConceptVersion` (append-only — a revision always creates a new row, never
overwrites) / `ReferenceImage` / `Artist` / `ArtistAssignment` /
`ProductionStage` / `ProductionUpdate` / `Artwork` / `ArtPassport` / `Order`
/ `Payment` / `Shipment` / `Review`.

Status-like fields are plain `String` (documented as unions in code
comments), not database-level enums — the canonical value sets are enforced
at the application boundary (e.g. `STAGE_ORDER` in `src/lib/admin/service.ts`)
so they stay easy to extend without a migration. Array-like fields
(`themes`, `colorPalette`, style tags, etc.) are stored as JSON strings and
parsed at the application boundary rather than using Postgres's native
`jsonb` type — this was a deliberate choice carried over from the project's
original SQLite-first design and preserved as-is during the C1 PostgreSQL
migration (changing it would be a schema/semantics change, not a database
swap).

### AI services (`src/lib/ai/`)

Each is a narrow, independently swappable module behind a typed function,
not one mega-prompt:

- **`creativeDirector.ts`** — story + intake → exactly 3 distinct creative
  directions (structured JSON via forced Claude tool-use)
- **`designInterpreter.ts`** — a chosen direction (+ optional revision
  feedback) → a structured design spec for the artist brief
- **`feasibilityAssistant.ts`** — advisory-only production considerations;
  never a feasibility verdict — that's the human artist's call
- **`visualConceptGenerator.ts`** — renders a concept visualization as a
  deterministic, labeled SVG ("CONCEPT VISUALIZATION — NOT FINAL"), not a
  paid image-gen call (no such credentials are configured here). The
  function signature is the swap point: point it at a real image model
  later without touching any caller
- **`artistMatchmaker.ts`** — simple style-tag-overlap heuristic used by
  admin's "suggest an artist" list; intentionally simple for MVP

All Claude calls go through **`gateway.ts`**, which centralizes model
choice, forced structured tool-use, and the offline-fallback check.

### Auth

Hand-rolled: bcrypt-hashed passwords, an httpOnly session cookie holding a
signed JWT (`jose`), verified in `src/proxy.ts` (Next 16 renamed
`middleware.ts` → `proxy.ts`) for `/admin`, `/account`, and `/create`, and
re-checked at the data layer (`src/lib/auth/guards.ts`) since Proxy doesn't
cover Server Functions.

#### Why not NextAuth

This project is built on **Next.js 16**, released very recently. Rather
than risk NextAuth/Auth.js compatibility issues with a framework version
that new, auth here is ~150 lines of well-understood primitives
(bcrypt + JWT + httpOnly cookie). It covers exactly what the MVP needs
(email/password, three roles) with no framework-version risk. Revisit this
if OAuth providers or passwordless login become requirements.

### Studio flow (`src/lib/studio/service.ts`)

`createCommission` → `selectDirection` → `reviseConcept` (repeatable) →
`approveVersion`. Every revision is a new `ConceptVersion` row; nothing is
ever overwritten, so the full history is always visible to both customer
and admin.

### Admin flow (`src/lib/admin/service.ts`)

Artist assignment, production-stage advancement (validated server-side to
stay in sequence even if a client is stale), progress updates with photos,
manual payment/shipment status, and Art Passport publishing (piece ID,
slug, QR code, care instructions).

## What's implemented vs. what's next

**Phase 1 (built):** homepage, Process/Artists pages, Custom Creation
Studio (AI directions, versioned revisions, concept visualization,
approval), commission creation, customer account dashboard, admin
commission dashboard with overview metrics.

**Phase 2 (built further than the brief's minimum):** artist assignment,
full production-stage tracking with customer-visible progress updates,
manual payment/shipment tracking, post-delivery reviews.

**Phase 3 (built the core of):** Art Passport with QR verification and a
public passport page.

**Deliberately not built** (per the brief's own guidance, and because they
need real third-party credentials this environment doesn't have): a live
payment gateway (Stripe et al. — `Payment` is currently an admin-tracked
ledger row), a paid image-generation model for concept art, a separate
artist-facing portal (admin currently manages artist-side updates on their
behalf), referrals, personalization, and deeper analytics beyond the admin
overview's basic metrics.

## Database

The app runs on **PostgreSQL** in every environment (dev/staging/production)
via the `@prisma/adapter-pg` driver adapter (`src/lib/db.ts`,
`prisma/seed.ts`). Nothing is SQLite-specific anymore — a prior version of
this project used SQLite for zero-config local dev; that migration is
complete (C1) and its old migration history is preserved for reference in
`prisma/migrations-archive/sqlite/` (not applied to any database).

### Local development — two supported options

**Option A — native PostgreSQL (recommended, lighter weight):**

```bash
# macOS
brew install postgresql@16
brew services start postgresql@16
createuser -s customdenim
createdb -O customdenim customdenim_dev
psql -c "ALTER USER customdenim WITH PASSWORD 'pick-a-local-password'"
```

Then set `DATABASE_URL` in `.env` to
`postgresql://customdenim:pick-a-local-password@localhost:5432/customdenim_dev?schema=public`.

This is the recommended default: no container runtime, minimal memory
overhead (relevant on an 8GB dev machine), and Postgres itself is what's
running in every other environment too.

**Option B — Docker Compose (if you prefer not to install Postgres
natively, or want easy teardown/reset):**

```bash
docker compose up -d db
```

See `docker-compose.yml` at the repo root — it starts a single `postgres:16`
container on `localhost:5432` with a persisted volume. Docker is **not**
required; use whichever option fits your machine.

### Migration history

`prisma/migrations/` holds the PostgreSQL migration history, starting from
`20260906173000_init_postgresql` — a clean baseline generated directly from
`prisma/schema.prisma` (via `prisma migrate diff --from-empty`), not a
port of the old SQLite SQL. Apply it with:

```bash
npx prisma migrate deploy
```

`npx prisma migrate dev` for creating new migrations locally, exactly as
before — this didn't change with the provider swap.

### Staging vs. production

Each environment gets its own PostgreSQL database and its own
`DATABASE_URL` — never share one connection string across environments.
Set `APP_ENV` to match (`staging` / `production`); `prisma/seed.ts` reads
it and refuses to run at all in `production` (see
[Environment variables](#environment-variables)).

### Data transfer from an existing SQLite database

If you have an existing `prisma/dev.db` (or any other SQLite database) you
want to carry data over from, see `scripts/transfer-sqlite-to-postgres.ts`.
It walks every model in foreign-key-safe order, upserts by primary key (so
re-running it is safe), and reports before/after counts per table. It also
prints a warning for any `User` row whose email doesn't match the seed
script's known accounts — **read that warning before trusting the
transferred data represents real customers**; the script does not delete,
guess, or silently promote ambiguous rows.

```bash
SOURCE_SQLITE_URL="file:./prisma/dev.db" npx tsx scripts/transfer-sqlite-to-postgres.ts
```

Run it against the target environment's `DATABASE_URL` (set normally in
`.env`/deployment config) — the source is passed separately via
`SOURCE_SQLITE_URL` so the two are never confused.

## Object storage

Reference images (Studio intake) and production update photos (admin) are
uploaded through `/api/uploads` and stored via `StorageService`
(`src/lib/storage/`) — every caller depends only on that interface, never on
a specific provider. Both asset kinds are **private** (see
[Object visibility](#object-visibility) below); nothing the app currently
displays publicly is stored this way — the AI concept image and Art
Passport's QR code are both inline-generated data URIs, not uploaded files.

### `STORAGE_PROVIDER=local` (dev default)

Writes to `.local-storage/` (gitignored, **not** under `public/` — Next's
static file serving would otherwise expose every object at a predictable
URL regardless of visibility) and serves it through
`/api/storage/local/[...key]`. Private objects get genuine short-lived
HMAC-signed URLs (signed with `AUTH_SECRET`, no extra config needed) — an
expired or tampered link is rejected with a 403, exactly like a real
signed S3 URL would be. No bucket or credentials required for local dev.

### `STORAGE_PROVIDER=s3` (staging/production)

Uses the AWS SDK v3 (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`)
against a configurable `S3_ENDPOINT`, so it works unmodified against real
AWS S3 (leave `S3_ENDPOINT` unset) or any S3-compatible provider —
Cloudflare R2, MinIO, DigitalOcean Spaces, Backblaze B2 — by setting
`S3_ENDPOINT` (and `S3_FORCE_PATH_STYLE` where that provider's docs call
for it). See `.env.example` for the full variable list. Two separate
buckets (`S3_PUBLIC_BUCKET` / `S3_PRIVATE_BUCKET`), not per-object ACLs —
several S3-compatible providers don't support fine-grained ACLs, but all of
them support "this bucket is public, that one isn't."

### Object visibility

| Category | Examples | Access |
|---|---|---|
| Private | Customer reference images, admin production photos | Short-lived signed URL, regenerated at render time — never persisted |
| Public | *(none in use yet)* Future Art Passport photos, Blender-authored GLB assets | Stable URL via `S3_PUBLIC_BASE_URL`, long browser cache |

### Object keys

Namespaced by owner, never by customer text: `private/customers/{userId}/references/{assetId}.ext`
(pre- or post-commission Studio uploads) and
`private/commissions/{commissionId}/production/{assetId}.ext` (admin
production photos) — see `src/lib/storage/objectKeys.ts`, which also
documents the reserved key conventions for future Art Passport/Blender/R3F
assets so those phases don't need a new storage architecture.

### Database representation

`ReferenceImage.url` / `ProductionUpdate.photoUrl` store the storage
**key**, not a URL — a signed URL expires, so persisting one would produce
a broken link later. `src/lib/storage/resolveAssetUrl()` turns a stored key
into a fresh, render-time URL wherever these fields are displayed
(`/account/commissions/[id]`, `/admin/commissions/[id]`). No schema change
was needed for this — same `String` columns, different content.

### Migrating existing local uploads

If you have files under `public/uploads/` from before object storage was
introduced, see `scripts/migrate-local-uploads-to-storage.ts`. It walks
every `ReferenceImage`/`ProductionUpdate` row that still points at
`/uploads/...`, re-validates the source file (same magic-byte check as the
upload route), uploads it, verifies the result by checksum, and only then
updates the row — safe to re-run (already-migrated rows are skipped), and
it never deletes source files. Any local file with no owning database row
is reported as **unowned** and left untouched; a human must resolve those.

```bash
STORAGE_PROVIDER=s3 ... npx tsx scripts/migrate-local-uploads-to-storage.ts
```

## Going to production

1. **Payments:** integrate Stripe (or similar) behind the existing `Order`
   / `Payment` models; the admin "mark paid" flow becomes a webhook
   handler instead of a manual button.
2. **Image generation:** swap `visualConceptGenerator.ts`'s implementation
   for a real image model call; keep the function signature.
3. Rotate `AUTH_SECRET` and every seeded password.
