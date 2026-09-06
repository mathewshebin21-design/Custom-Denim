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
      "img-src 'self' data:",
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
