"use client";

import dynamic from "next/dynamic";

// `next/dynamic` with `ssr: false` must be called from a Client Component —
// this thin wrapper is that boundary, so the server-rendered preview page
// itself stays a plain Server Component.
const JacketViewer3D = dynamic(
  () => import("./JacketViewer3D").then((m) => m.JacketViewer3D),
  {
    ssr: false,
    loading: () => (
      <div className="flex aspect-[4/5] w-full max-w-md items-center justify-center bg-paper-dim text-sm text-ink/40">
        Loading 3D preview…
      </div>
    ),
  },
);

export function JacketViewer3DLoader() {
  return <JacketViewer3D />;
}
