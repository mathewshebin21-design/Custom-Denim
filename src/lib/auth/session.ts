import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "cd_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "customer" | "artist" | "admin";
};

const MIN_SECRET_LENGTH = 32;
// Values that ship in this repo's own .env.example / README as illustrative
// placeholders — real deployments must not still be using these.
const KNOWN_PLACEHOLDER_SECRETS = new Set([
  "replace-with-a-random-32-byte-secret",
  "dev-only-insecure-secret-change-me-before-deploying",
]);

let warnedWeakSecretInDev = false;

/**
 * Every session token is signed with this secret; a weak or leaked one
 * compromises every account, including admin. In production this throws
 * rather than silently signing tokens with a guessable key. In development
 * it only warns once, so the existing local workflow (`openssl rand` never
 * required just to run `npm run dev`) still works.
 */
function assertAuthSecretStrength(secret: string) {
  const isWeak = secret.length < MIN_SECRET_LENGTH || KNOWN_PLACEHOLDER_SECRETS.has(secret);
  if (!isWeak) return;

  if (process.env.NODE_ENV === "production") {
    // Never include the secret's value here — only that it failed the check.
    throw new Error(
      `AUTH_SECRET does not meet the minimum strength required outside development ` +
        `(at least ${MIN_SECRET_LENGTH} random characters, not a known placeholder). ` +
        `Generate one with: openssl rand -base64 32`,
    );
  }
  if (!warnedWeakSecretInDev) {
    warnedWeakSecretInDev = true;
    console.warn(
      `[auth] AUTH_SECRET is short or a known placeholder. This is only tolerated because ` +
        `NODE_ENV !== "production" — it must be replaced before deploying.`,
    );
  }
}

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set");
  }
  assertAuthSecretStrength(secret);
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email, name: user.name, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (!payload.sub || typeof payload.email !== "string" || typeof payload.name !== "string") {
      return null;
    }
    const role = payload.role;
    if (role !== "customer" && role !== "artist" && role !== "admin") return null;
    return { id: payload.sub, email: payload.email, name: payload.name, role };
  } catch {
    return null;
  }
}

/** Read the current session from cookies. Returns null if absent/invalid. */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};
