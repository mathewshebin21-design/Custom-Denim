import type { NextConfig } from "next";

// Baseline security headers. This app loads no external scripts, styles, or
// fonts anywhere (next/font self-hosts Google Fonts as static files at build
// time, so there's no runtime request to a font CDN) — verified by grep
// across src/ before writing this policy — so a same-origin CSP is safe
// without breaking anything today.
//
// `script-src`/`style-src` include 'unsafe-inline' because Next's own App
// Router hydration bootstrap relies on inline scripts, and a strict
// nonce-based policy would require threading a per-request nonce through
// src/proxy.ts and every page — a larger, riskier change than this hardening
// pass should take on. That's the honest tradeoff: this blocks any
// cross-origin script/style/font/image/connect/frame use (a real class of
// attack), but does not defend against inline-script injection on this
// origin. Upgrading to a nonce-based strict CSP is a Phase C item, not done
// here.
//
// 'unsafe-eval' is added to script-src only outside production: React's
// development build uses eval() to reconstruct component stacks for its own
// debugging overlay (confirmed via its own console warning — "React will
// never use eval() in production mode"), so a strict policy would spam dev
// console errors without protecting anything, since production never calls
// eval() regardless of what CSP allows.
const isProd = process.env.NODE_ENV === "production";
const scriptSrc = isProd ? "script-src 'self' 'unsafe-inline'" : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

// C2: when object storage is backed by S3 (STORAGE_PROVIDER=s3), reference
// images and production photos are served from the public bucket's base
// URL and/or the S3 endpoint (private signed URLs point at the endpoint
// directly) — both origins, and only those, are added to img-src. Local
// dev (STORAGE_PROVIDER=local) serves everything same-origin through
// /api/storage/local/..., so 'self' already covers it with no CSP change.
function storageImageOrigins(): string[] {
  if (process.env.STORAGE_PROVIDER !== "s3") return [];
  const origins = new Set<string>();
  for (const raw of [process.env.S3_PUBLIC_BASE_URL, process.env.S3_ENDPOINT]) {
    if (!raw) continue;
    try {
      origins.add(new URL(raw).origin);
    } catch {
      // Malformed value — skip rather than let a bad env var widen img-src
      // to something unparseable/unintended.
    }
  }
  return [...origins];
}

const imgSrc = ["img-src", "'self'", "data:", ...storageImageOrigins()].join(" ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      imgSrc,
      "font-src 'self'",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
