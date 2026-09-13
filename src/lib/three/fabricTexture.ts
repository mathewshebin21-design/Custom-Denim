import * as THREE from "three";
import type { FabricKind } from "@/components/studio/jacketMaterials";

/**
 * Procedurally draws a fabric-weave pattern onto an offscreen 2D canvas and
 * returns it as a `THREE.CanvasTexture` — entirely client-side, no network
 * fetch. This is deliberate: an earlier version of this viewer used drei's
 * `<Environment preset="studio">`, which fetches an HDRI from an external
 * CDN at runtime and was blocked outright by the site's CSP
 * (`connect-src 'self'`) — see JacketViewer3D.tsx's lighting comment. A
 * generated texture never has that failure mode.
 *
 * Only called from Client Components already inside the R3F Canvas
 * boundary (`ssr: false`), so `document`/canvas APIs are always available.
 */

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const value = parseInt(clean, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function shade(rgb: [number, number, number], amount: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `rgb(${clamp(rgb[0] + amount)}, ${clamp(rgb[1] + amount)}, ${clamp(rgb[2] + amount)})`;
}

function drawDenim(ctx: CanvasRenderingContext2D, size: number, rgb: [number, number, number]) {
  ctx.fillStyle = shade(rgb, 0);
  ctx.fillRect(0, 0, size, size);

  // Diagonal twill weave: two offset sets of parallel diagonal threads,
  // alternating a lighter and darker tone of the base wash color.
  const step = size / 20;
  ctx.lineWidth = step * 0.55;
  for (let i = -size; i < size * 2; i += step) {
    ctx.strokeStyle = shade(rgb, 20);
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + size, size);
    ctx.stroke();

    ctx.strokeStyle = shade(rgb, -16);
    ctx.beginPath();
    ctx.moveTo(i + step / 2, 0);
    ctx.lineTo(i + step / 2 + size, size);
    ctx.stroke();
  }

  // Fine grain speckle for a cotton-fiber feel.
  ctx.globalAlpha = 0.08;
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = shade(rgb, Math.random() > 0.5 ? 26 : -22);
    ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1);
  }
  ctx.globalAlpha = 1;
}

function drawCorduroy(ctx: CanvasRenderingContext2D, size: number, rgb: [number, number, number]) {
  ctx.fillStyle = shade(rgb, 0);
  ctx.fillRect(0, 0, size, size);

  const ribWidth = size / 12;
  for (let x = 0; x < size; x += ribWidth) {
    const gradient = ctx.createLinearGradient(x, 0, x + ribWidth, 0);
    gradient.addColorStop(0, shade(rgb, -24));
    gradient.addColorStop(0.5, shade(rgb, 24));
    gradient.addColorStop(1, shade(rgb, -24));
    ctx.fillStyle = gradient;
    ctx.fillRect(x, 0, ribWidth, size);
  }
}

function drawCanvas(ctx: CanvasRenderingContext2D, size: number, rgb: [number, number, number]) {
  ctx.fillStyle = shade(rgb, 0);
  ctx.fillRect(0, 0, size, size);

  const step = size / 28;
  ctx.globalAlpha = 0.14;
  for (let x = 0; x < size; x += step * 2) {
    ctx.fillStyle = shade(rgb, 12);
    ctx.fillRect(x, 0, step, size);
  }
  for (let y = 0; y < size; y += step * 2) {
    ctx.fillStyle = shade(rgb, -12);
    ctx.fillRect(0, y, size, step);
  }
  ctx.globalAlpha = 1;
}

export function createFabricTexture(kind: FabricKind, baseHex: string): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");

  const rgb = hexToRgb(baseHex);
  if (kind === "denim") drawDenim(ctx, size, rgb);
  else if (kind === "corduroy") drawCorduroy(ctx, size, rgb);
  else drawCanvas(ctx, size, rgb);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
