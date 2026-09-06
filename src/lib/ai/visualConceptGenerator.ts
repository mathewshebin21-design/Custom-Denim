/**
 * Visual Concept Generator — produces a concept visualization for a
 * creative direction + design spec.
 *
 * This implementation renders a deterministic, abstract SVG "concept card"
 * from the direction's palette and title rather than calling a paid image
 * model (no image-gen credentials are wired up in this environment). It
 * intentionally looks and is labeled like a concept sketch, never a
 * finished-garment photo, per the product principle that concept imagery
 * must never be mistaken for the final piece.
 *
 * Swap point: replace `renderConceptSvg` below with a call to a real
 * image-generation provider (e.g. an image model given the same palette
 * and motifs as a prompt) without touching any caller — every call site
 * only depends on this module's exported `generateConceptImage` signature.
 */

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const NAMED_COLORS: Record<string, string> = {
  indigo: "#3b3a6e",
  "faded indigo": "#5a5a8f",
  black: "#1a1a1a",
  "ink black": "#141414",
  white: "#f5f3ee",
  "bone white": "#efe9dd",
  grey: "#6b6b6b",
  gray: "#6b6b6b",
  "smoke grey": "#7a7a7a",
  rust: "#a8532b",
  "rust orange": "#b1592c",
  gold: "#c9a24b",
  crimson: "#9c2b3a",
  denim: "#3f5b76",
  navy: "#1f2c4a",
  cream: "#e9e2cf",
  olive: "#5c5a3a",
  teal: "#2a6b6b",
  burgundy: "#5c1f2e",
};

function colorFor(name: string): string {
  const key = name.trim().toLowerCase();
  if (NAMED_COLORS[key]) return NAMED_COLORS[key];
  const hue = hashString(key) % 360;
  return `hsl(${hue}, 42%, 38%)`;
}

function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderConceptSvg(title: string, palette: string[], seed: string): string {
  const colors = (palette.length ? palette : ["indigo", "rust", "bone white"]).map(colorFor);
  const seedNum = hashString(seed);
  const width = 640;
  const height = 800;

  const shapes: string[] = [];
  const shapeCount = 5 + (seedNum % 4);
  for (let i = 0; i < shapeCount; i++) {
    const n = seedNum + i * 97;
    const cx = (n * 13) % width;
    const cy = 80 + ((n * 31) % (height - 200));
    const r = 60 + ((n * 17) % 180);
    const color = colors[i % colors.length];
    const opacity = 0.18 + ((n % 30) / 100);
    shapes.push(
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="${opacity.toFixed(2)}" />`,
    );
  }

  const swatches = colors
    .slice(0, 6)
    .map((c, i) => `<rect x="${32 + i * 44}" y="${height - 64}" width="32" height="32" rx="4" fill="${c}" />`)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${colors[0]}" stop-opacity="0.9" />
      <stop offset="100%" stop-color="#0d0d0f" stop-opacity="0.95" />
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="#0d0d0f" />
  <rect width="${width}" height="${height}" fill="url(#bg)" opacity="0.55" />
  ${shapes.join("\n  ")}
  <rect x="0" y="0" width="${width}" height="${height}" fill="none" stroke="#f5f3ee" stroke-opacity="0.15" stroke-width="2" />
  <text x="32" y="56" font-family="Georgia, serif" font-size="34" fill="#f5f3ee" letter-spacing="2">${escapeXml(title.toUpperCase())}</text>
  ${swatches}
  <text x="32" y="${height - 88}" font-family="Helvetica, Arial, sans-serif" font-size="14" fill="#f5f3ee" opacity="0.7" letter-spacing="3">CONCEPT VISUALIZATION — NOT FINAL</text>
</svg>`;
}

export function generateConceptImage(params: {
  title: string;
  colorPalette: string[];
  versionSeed: string;
}): string {
  const svg = renderConceptSvg(params.title, params.colorPalette, params.versionSeed);
  const base64 = Buffer.from(svg, "utf-8").toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}
