import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
    // Optional: only needed for `prisma migrate dev` / `migrate diff` against
    // migration history, which replay migrations against a scratch database
    // rather than the real one. Unset in production — those commands aren't
    // used there anyway (`migrate deploy` doesn't need a shadow database).
    shadowDatabaseUrl: process.env["SHADOW_DATABASE_URL"],
  },
});
