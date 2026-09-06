# Archived SQLite migration history

This directory preserves the SQLite-provider migration history from before
the C1 PostgreSQL migration (see README.md "Database"). These migrations are
**not applicable to PostgreSQL** — SQLite and PostgreSQL are different
Prisma "migration providers" (recorded in `migration_lock.toml`), and the
DDL itself uses SQLite-specific type affinities (`DATETIME`, inline
`CONSTRAINT ... FOREIGN KEY`) that don't translate directly.

Rather than forcing this history onto PostgreSQL, C1 established a fresh,
deliberate PostgreSQL baseline migration (see `prisma/migrations/`) generated
directly from the same `prisma/schema.prisma` these SQLite migrations also
implemented — so the resulting PostgreSQL schema is equivalent in every way
that matters (tables, columns, constraints, indexes), just expressed as a
new migration history appropriate for the new provider.

This archive is kept for historical context only. It is not applied to any
database and is not read by Prisma at runtime.
