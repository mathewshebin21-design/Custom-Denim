/**
 * Material/fabric options for the placeholder 3D jacket viewer
 * (`JacketViewer3D.tsx`). Deliberately data-only (no "three"/React import)
 * so it can be shared by the picker UI and the viewer without pulling
 * either into the other's bundle boundary.
 *
 * Two independent axes, matching how a real denim commission is actually
 * specified: which fabric (weave/texture) and which wash/color. Swapping in
 * a real Blender-authored asset later only means teaching its materials to
 * read these same `FabricKind`/wash-hex values — this file doesn't change.
 */

export type FabricKind = "denim" | "corduroy" | "canvas";

export interface FabricOption {
  id: FabricKind;
  label: string;
  description: string;
  roughness: number;
  metalness: number;
}

export const FABRIC_OPTIONS: FabricOption[] = [
  {
    id: "denim",
    label: "Denim Twill",
    description: "Classic diagonal twill weave — the studio's signature canvas.",
    roughness: 0.9,
    metalness: 0.02,
  },
  {
    id: "corduroy",
    label: "Corduroy",
    description: "Vertical wale ribbing for a heavier, textured finish.",
    roughness: 0.95,
    metalness: 0,
  },
  {
    id: "canvas",
    label: "Canvas",
    description: "Tight plain weave, smoother and more matte.",
    roughness: 0.75,
    metalness: 0,
  },
];

export interface WashOption {
  id: string;
  label: string;
  hex: string;
}

export const WASH_OPTIONS: WashOption[] = [
  { id: "raw-indigo", label: "Raw Indigo", hex: "#2b3a55" },
  { id: "stonewash", label: "Stonewash", hex: "#5c7288" },
  { id: "black", label: "Black Denim", hex: "#22252b" },
  { id: "bleached", label: "Bleached White", hex: "#e7e2d3" },
  { id: "rust-overdye", label: "Rust Overdye", hex: "#7a4a34" },
];

export const DEFAULT_FABRIC: FabricKind = "denim";
export const DEFAULT_WASH_ID: string = WASH_OPTIONS[0].id;

export function washById(id: string): WashOption {
  return WASH_OPTIONS.find((w) => w.id === id) ?? WASH_OPTIONS[0];
}

export function fabricById(id: FabricKind): FabricOption {
  return FABRIC_OPTIONS.find((f) => f.id === id) ?? FABRIC_OPTIONS[0];
}
