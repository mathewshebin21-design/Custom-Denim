export interface ConceptImageParams {
  title: string;
  narrative: string;
  colorPalette: string[];
  themes: string[];
  placement?: string;
  garmentLabel: string;
  /** Unique per (direction, version) — used as the placeholder's visual
   * seed and, for the real provider, has no effect beyond namespacing. */
  versionSeed: string;
}
