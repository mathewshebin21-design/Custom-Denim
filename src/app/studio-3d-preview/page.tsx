import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { JacketViewer3DLoader } from "@/components/studio/JacketViewer3DLoader";

export const metadata: Metadata = {
  title: "3D Preview (Internal)",
  robots: { index: false, follow: false },
};

/**
 * Deliberately NOT linked from any navigation and NOT part of the live
 * customer Studio flow. This route exists only to prove the React Three
 * Fiber integration (Canvas, SSR handling, lighting, controls) works,
 * ahead of a real Blender-authored garment asset existing. See
 * JacketViewer3D.tsx for why the geometry itself is a placeholder.
 */
export default async function Studio3DPreviewPage() {
  // Not covered by src/proxy.ts's matcher (which only guards /admin,
  // /account, /create) — this internal dev-only route enforces its own
  // admin check directly, matching this codebase's existing
  // defense-in-depth pattern for admin-only pages.
  await requireAdmin();

  return (
    <div className="container-editorial py-24">
      <p className="label-eyebrow text-rust mb-4">Internal / Not Customer-Facing</p>
      <h1 className="font-display text-3xl mb-4">3D Viewer — Scaffolding Preview</h1>
      <p className="max-w-xl text-sm text-ink/70 mb-10">
        This proves the React Three Fiber viewer integration (camera,
        lighting, orbit controls, SSR handling) renders correctly. The
        geometry shown is a placeholder box-jacket, not a real garment —
        no Blender-authored asset exists yet. This page is not linked from
        the site&apos;s navigation and is not part of the customer-facing
        Custom Creation Studio.
      </p>
      <JacketViewer3DLoader />
    </div>
  );
}
