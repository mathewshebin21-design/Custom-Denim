import "server-only";
import { NextResponse } from "next/server";
import { getSession, type SessionUser } from "./session";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new ApiError(401, "You must be signed in");
  return session;
}

export async function requireAdmin(): Promise<SessionUser> {
  const session = await requireSession();
  if (session.role !== "admin") throw new ApiError(403, "Admins only");
  return session;
}

export function handleApiError(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error(err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
