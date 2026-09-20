import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

/**
 * One-time admin account creation, gated by a secret only the site owner
 * has (ADMIN_SETUP_TOKEN) and self-disabling the moment any admin exists —
 * so it can be left in the codebase permanently rather than needing to be
 * torn out after first use. There is no admin-signup flow anywhere else:
 * /api/auth/register always hardcodes role "customer", so this is the only
 * path by which the "admin" role is ever granted outside prisma/seed.ts
 * (which itself refuses to run against a production APP_ENV).
 */
const BootstrapSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(12, "Admin password must be at least 12 characters"),
});

const LIMIT = 5;
const WINDOW_MS = 15 * 60 * 1000;

function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const expectedToken = process.env.ADMIN_SETUP_TOKEN;
  if (!expectedToken) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rate = await checkRateLimit("admin-bootstrap", getClientIp(request), LIMIT, WINDOW_MS);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = BootstrapSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { token, name, email, password } = parsed.data;

  if (!tokenMatches(token, expectedToken)) {
    return NextResponse.json({ error: "Invalid setup token" }, { status: 403 });
  }

  const adminCount = await db.user.count({ where: { role: "admin" } });
  if (adminCount > 0) {
    return NextResponse.json({ error: "Setup already completed — an admin account already exists" }, { status: 403 });
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await db.user.create({
    data: { email, name, passwordHash, role: "admin" },
  });

  return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } }, { status: 201 });
}
