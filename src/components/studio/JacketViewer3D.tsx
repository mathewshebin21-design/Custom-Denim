"use client";

import { Suspense, useEffect, useMemo } from "react";
import type { Texture } from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import { createFabricTexture } from "@/lib/three/fabricTexture";
import {
  DEFAULT_FABRIC,
  DEFAULT_WASH_ID,
  fabricById,
  washById,
  type FabricKind,
} from "./jacketMaterials";

/**
 * PLACEHOLDER 3D scene — not a Blender-authored garment asset. No .glb/.gltf
 * file exists anywhere in this repository; producing a real garment model
 * requires actual 3D authoring (Blender) outside of code, per the frozen
 * Blender + R3F architecture spec. This component exists so the R3F
 * integration (Canvas setup, SSR handling, camera/lighting, controls,
 * material system) is proven and ready — swapping in a real asset later
 * means replacing `PlaceholderJacket`'s geometry with a `useGLTF()` loader
 * call and keeping its mesh names mapped to the same fabric/wash material,
 * not rebuilding this scaffolding.
 *
 * The fabric/wash material system (`jacketMaterials.ts`,
 * `@/lib/three/fabricTexture.ts`) is NOT placeholder — it's built to be the
 * real material-selection architecture, applied to placeholder geometry
 * for now. A procedurally generated canvas texture (not an external image)
 * stands in for a real fabric photo/normal-map set.
 *
 * Rendered only from the isolated /studio-3d-preview route (not linked in
 * navigation, not mixed into the live customer Studio flow) — a crude
 * procedural shape has no business appearing next to real commission data
 * on a product positioned as "premium, artist-made, one-of-one."
 */

function useJacketTexture(fabric: FabricKind, washHex: string): Texture {
  const texture = useMemo(() => createFabricTexture(fabric, washHex), [fabric, washHex]);
  // Textures created imperatively (outside R3F's own JSX-tracked elements)
  // aren't auto-disposed by the reconciler — dispose the previous one
  // ourselves whenever fabric/wash changes or the viewer unmounts.
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

function PlaceholderJacket({
  texture,
  roughness,
  metalness,
}: {
  texture: Texture;
  roughness: number;
  metalness: number;
}) {
  return (
    <group position={[0, -0.4, 0]}>
      {/* Chest/shoulder block */}
      <mesh castShadow receiveShadow position={[0, 0.85, 0]}>
        <boxGeometry args={[1.4, 0.9, 0.5]} />
        <meshStandardMaterial map={texture} roughness={roughness} metalness={metalness} />
      </mesh>
      {/* Waist block, slightly narrower — a rough tapered silhouette */}
      <mesh castShadow receiveShadow position={[0, 0.15, 0]}>
        <boxGeometry args={[1.28, 0.7, 0.48]} />
        <meshStandardMaterial map={texture} roughness={roughness} metalness={metalness} />
      </mesh>
      {/* Sleeves */}
      <mesh castShadow receiveShadow position={[-0.95, 0.7, 0]}>
        <boxGeometry args={[0.45, 1.2, 0.4]} />
        <meshStandardMaterial map={texture} roughness={roughness} metalness={metalness} />
      </mesh>
      <mesh castShadow receiveShadow position={[0.95, 0.7, 0]}>
        <boxGeometry args={[0.45, 1.2, 0.4]} />
        <meshStandardMaterial map={texture} roughness={roughness} metalness={metalness} />
      </mesh>
      {/* Collar */}
      <mesh castShadow receiveShadow position={[0, 1.45, 0]}>
        <boxGeometry args={[0.7, 0.2, 0.55]} />
        <meshStandardMaterial map={texture} roughness={roughness} metalness={metalness} />
      </mesh>
      {/* Lapels, angled to suggest a jacket's open collar */}
      <mesh castShadow receiveShadow position={[-0.22, 1.05, 0.26]} rotation={[0, 0, 0.35]}>
        <boxGeometry args={[0.32, 0.55, 0.06]} />
        <meshStandardMaterial map={texture} roughness={roughness} metalness={metalness} />
      </mesh>
      <mesh castShadow receiveShadow position={[0.22, 1.05, 0.26]} rotation={[0, 0, -0.35]}>
        <boxGeometry args={[0.32, 0.55, 0.06]} />
        <meshStandardMaterial map={texture} roughness={roughness} metalness={metalness} />
      </mesh>
      {/* Center-front placket — a fixed dark accent regardless of fabric/wash,
          standing in for stitching/hardware rather than the shell fabric */}
      <mesh position={[0, 0.5, 0.26]}>
        <boxGeometry args={[0.04, 1.3, 0.02]} />
        <meshStandardMaterial color="#1a1d22" roughness={0.6} />
      </mesh>
    </group>
  );
}

export interface JacketViewer3DProps {
  fabric?: FabricKind;
  washId?: string;
}

export function JacketViewer3D({ fabric = DEFAULT_FABRIC, washId = DEFAULT_WASH_ID }: JacketViewer3DProps) {
  const fabricOption = fabricById(fabric);
  const wash = washById(washId);
  const texture = useJacketTexture(fabric, wash.hex);

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
          <PlaceholderJacket texture={texture} roughness={fabricOption.roughness} metalness={fabricOption.metalness} />
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
