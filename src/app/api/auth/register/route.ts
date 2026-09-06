import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required"),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { email, password, name } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await db.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: "customer",
      customerProfile: { create: {} },
    },
  });

  const token = await createSessionToken({ id: user.id, email: user.email, name: user.name, role: "customer" });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions);

  return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
}
