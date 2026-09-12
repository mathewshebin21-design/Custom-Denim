"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";

/**
 * PLACEHOLDER 3D scene — not a Blender-authored garment asset. No .glb/.gltf
 * file exists anywhere in this repository; producing a real garment model
 * requires actual 3D authoring (Blender) outside of code, per the frozen
 * Blender + R3F architecture spec. This component exists so the R3F
 * integration (Canvas setup, SSR handling, camera/lighting, controls,
 * fallback behavior) is proven and ready — swapping in a real asset later
 * means replacing `PlaceholderJacket` with a `useGLTF()` loader call, not
 * rebuilding this scaffolding.
 *
 * Rendered only from the isolated /studio-3d-preview route (not linked in
 * navigation, not mixed into the live customer Studio flow) — a crude
 * procedural shape has no business appearing next to real commission data
 * on a product positioned as "premium, artist-made, one-of-one."
 */

function PlaceholderJacket() {
  return (
    <group position={[0, -0.4, 0]}>
      {/* Torso */}
      <mesh castShadow receiveShadow position={[0, 0.6, 0]}>
        <boxGeometry args={[1.4, 1.6, 0.5]} />
        <meshStandardMaterial color="#3f5b76" roughness={0.85} metalness={0.05} />
      </mesh>
      {/* Sleeves */}
      <mesh castShadow receiveShadow position={[-0.95, 0.7, 0]}>
        <boxGeometry args={[0.45, 1.2, 0.4]} />
        <meshStandardMaterial color="#3f5b76" roughness={0.85} metalness={0.05} />
      </mesh>
      <mesh castShadow receiveShadow position={[0.95, 0.7, 0]}>
        <boxGeometry args={[0.45, 1.2, 0.4]} />
        <meshStandardMaterial color="#3f5b76" roughness={0.85} metalness={0.05} />
      </mesh>
      {/* Collar */}
      <mesh castShadow receiveShadow position={[0, 1.45, 0]}>
        <boxGeometry args={[0.7, 0.2, 0.55]} />
        <meshStandardMaterial color="#33465a" roughness={0.8} />
      </mesh>
    </group>
  );
}

export function JacketViewer3D() {
  return (
    <div className="relative aspect-[4/5] w-full max-w-md bg-paper-dim">
      <Canvas
        shadows
        camera={{ position: [2.2, 1.2, 2.8], fov: 40 }}
        gl={{ antialias: true }}
      >
        <Suspense fallback={null}>
          {/* Local-only lighting rig (no drei <Environment> preset) — Environment
              presets fetch an HDRI from an external CDN at runtime, which the
              site's CSP (connect-src 'self') correctly blocks. A few manually
              placed lights avoid the network dependency entirely. */}
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 4, 2]} intensity={1.2} castShadow />
          <directionalLight position={[-3, 2, -2]} intensity={0.4} />
          <pointLight position={[0, 1, 3]} intensity={0.3} />
          <PlaceholderJacket />
          <ContactShadows position={[0, -1.05, 0]} opacity={0.35} scale={6} blur={2} />
        </Suspense>
        <OrbitControls
          enablePan={false}
          minDistance={2}
          maxDistance={5}
          maxPolarAngle={Math.PI / 1.8}
        />
      </Canvas>
      <p className="absolute bottom-2 left-2 right-2 text-center text-[10px] uppercase tracking-[0.18em] text-ink/40">
        Placeholder geometry — not final product art
      </p>
    </div>
  );
}
