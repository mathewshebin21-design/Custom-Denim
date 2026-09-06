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
- **Prisma 7** ORM on **SQLite** (via the `@prisma/adapter-libsql` driver
  adapter) for zero-config local dev — swap to Postgres for production (see
  [Going to production](#going-to-production))
- **Hand-rolled session auth** (bcrypt + signed JWT cookies via `jose`) —
  chosen over NextAuth to avoid an unstable dependency on a framework this
  new; see [Why not NextAuth](#why-not-nextauth)
- **Anthropic Claude** (`@anthropic-ai/sdk`) for the AI Creative
  Director / Design Interpreter / Feasibility Assistant, called via forced
  tool-use for structured JSON output
- **QR codes** (`qrcode`) for Art Passport verification links
- Local-disk uploads for reference images and production photos (swap for
  an S3-compatible bucket in production)

## Getting started

```bash
npm install
cp .env.example .env   # defaults work as-is for local dev (SQLite, no AI key needed)
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
| `DATABASE_URL` | yes | SQLite file path in dev (`file:./prisma/dev.db`); Postgres connection string in production |
| `AUTH_SECRET` | yes | Signs session JWTs. Generate with `openssl rand -base64 32` |
| `ANTHROPIC_API_KEY` | no | Powers the real AI Creative Director / Design Interpreter / Feasibility Assistant. **Without it, the Studio runs in a clearly-labeled offline fallback mode** — deterministic, hand-written creative directions so the whole flow (including versioning, revisions, approval) still works for demos and testing without a key |
| `ANTHROPIC_MODEL` | no | Overrides the Claude model ID (defaults to `claude-sonnet-5`) |
| `APP_BASE_URL` | yes | Used to build the Art Passport's QR-code URL |
| `APP_ENV` | yes | `development`, `staging`, or `production`. `prisma/seed.ts` refuses to run unless this is `development` or `staging` — see below |

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

SQLite doesn't support native enums or array columns, so status-like fields
are plain `String` (documented as unions in code comments) and array-like
fields (`themes`, `colorPalette`, style tags, etc.) are stored as JSON
strings and parsed at the application boundary. This keeps the schema
portable to Postgres without a rewrite.

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
ledger row), real object storage for uploads (currently local disk),
a paid image-generation model for concept art, a separate artist-facing
portal (admin currently manages artist-side updates on their behalf),
referrals, personalization, and deeper analytics beyond the admin
overview's basic metrics.

## Going to production

1. **Database:** change `datasource.provider` in `prisma/schema.prisma` to
   `postgresql`, set `DATABASE_URL` to a Postgres connection string, and
   swap `PrismaLibSql` for `PrismaPg` (`@prisma/adapter-pg`) in
   `src/lib/db.ts` and `prisma/seed.ts`.
2. **File storage:** replace `src/app/api/uploads/route.ts`'s local
   `fs.writeFile` with an S3-compatible upload; callers only depend on the
   `{ url }` response shape.
3. **Payments:** integrate Stripe (or similar) behind the existing `Order`
   / `Payment` models; the admin "mark paid" flow becomes a webhook
   handler instead of a manual button.
4. **Image generation:** swap `visualConceptGenerator.ts`'s implementation
   for a real image model call; keep the function signature.
5. Rotate `AUTH_SECRET` and every seeded password.
