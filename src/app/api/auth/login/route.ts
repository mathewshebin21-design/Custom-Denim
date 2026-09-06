import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const role = user.role as "customer" | "artist" | "admin";
  const token = await createSessionToken({ id: user.id, email: user.email, name: user.name, role });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions);

  return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, role } });
}
