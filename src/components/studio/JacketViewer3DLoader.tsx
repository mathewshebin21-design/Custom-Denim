"use client";

import dynamic from "next/dynamic";

// `next/dynamic` with `ssr: false` must be called from a Client Component —
// this thin wrapper is that boundary, so the server-rendered preview page
// itself stays a plain Server Component. Loads the configurator (viewer +
// material picker together), not just the bare viewer, since the picker
// also needs client-side state and there's no reason to split that state
// across the SSR boundary.
const JacketConfigurator = dynamic(
  () => import("./JacketConfigurator").then((m) => m.JacketConfigurator),
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
  return <JacketConfigurator />;
}
