"use client";

import { Suspense, useEffect, useMemo } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, ContactShadows, useGLTF } from "@react-three/drei";
import { createFabricTexture } from "@/lib/three/fabricTexture";
import {
  DEFAULT_FABRIC,
  DEFAULT_WASH_ID,
  fabricById,
  washById,
  type FabricKind,
} from "./jacketMaterials";

/**
 * `public/models/denim-jacket.glb` is a procedurally scripted jacket mesh
 * (torso loft, tapered sleeves, stand-up collar, front placket) built via
 * Blender's Python API, not a professional Blender artist's hand-modeled
 * asset — no human 3D artist has touched this shape. It replaces an earlier
 * box-primitive placeholder and is a real step up (proper tapered
 * silhouette, smooth subdivision-surface shading, correctly hanging
 * sleeves) but is still a simplified single-shell garment: no fabric
 * folds/wrinkles, no lapels (an earlier attempt at scripted lapel geometry
 * didn't read correctly and was removed rather than shipped broken), no
 * lining. Swapping in a real artist-modeled asset later is a drop-in
 * replacement: point `JACKET_MODEL_URL` at the new file and keep its denim
 * shell material named "DenimBlue" so this material system still finds it.
 *
 * The fabric/wash material system (`jacketMaterials.ts`,
 * `@/lib/three/fabricTexture.ts`) is NOT placeholder — it's the real
 * material-selection architecture, now driving an actual garment mesh
 * instead of boxes. A procedurally generated canvas texture (not an
 * external image) stands in for a real fabric photo/normal-map set.
 *
 * Rendered only from the isolated /studio-3d-preview route (not linked in
 * navigation, not mixed into the live customer Studio flow) — this is
 * scaffolding proving the pipeline works, not customer-facing product art.
 */

const JACKET_MODEL_URL = "/models/denim-jacket.glb";
const DENIM_MATERIAL_NAME = "DenimBlue";

function useJacketTexture(fabric: FabricKind, washHex: string): THREE.Texture {
  const texture = useMemo(() => createFabricTexture(fabric, washHex), [fabric, washHex]);
  // Textures created imperatively (outside R3F's own JSX-tracked elements)
  // aren't auto-disposed by the reconciler — dispose the previous one
  // ourselves whenever fabric/wash changes or the viewer unmounts.
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

function JacketModel({
  texture,
  roughness,
  metalness,
}: {
  texture: THREE.Texture;
  roughness: number;
  metalness: number;
}) {
  const { scene } = useGLTF(JACKET_MODEL_URL);

  // Clone per-instance so material edits below never mutate drei's shared
  // GLTF cache (harmless with a single viewer instance today, but this
  // component has no business assuming it'll never be rendered twice).
  // Also strips the camera/lights baked into the export — the Blender
  // scene's own lighting rig was tuned for its preview render, not this
  // Canvas, and would otherwise double up with the lights below.
  const cloned = useMemo(() => {
    const clone = scene.clone(true);
    const toRemove: THREE.Object3D[] = [];
    clone.traverse((obj) => {
      if ((obj as THREE.Light).isLight || (obj as THREE.Camera).isCamera) {
        toRemove.push(obj);
        return;
      }
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat && mat.name === DENIM_MATERIAL_NAME) {
          mesh.material = mat.clone();
        }
      }
    });
    toRemove.forEach((obj) => obj.parent?.remove(obj));
    return clone;
  }, [scene]);

  useEffect(() => {
    cloned.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat && mat.name === DENIM_MATERIAL_NAME) {
        // Reset the imported base color to white first — otherwise it tints
        // (multiplies with) the fabric texture below, double-darkening it.
        mat.color.setRGB(1, 1, 1);
        mat.map = texture;
        mat.roughness = roughness;
        mat.metalness = metalness;
        mat.needsUpdate = true;
      }
    });
  }, [cloned, texture, roughness, metalness]);

  // The model is authored at real-world (metre) scale; scaled/offset here
  // to frame similarly to the camera/controls tuned for the old placeholder.
  return <primitive object={cloned} scale={2.8} position={[0, -1.0, 0]} />;
}

useGLTF.preload(JACKET_MODEL_URL);

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
          <JacketModel texture={texture} roughness={fabricOption.roughness} metalness={fabricOption.metalness} />
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
        Scripted geometry — not a professional 3D asset
      </p>
    </div>
  );
}
