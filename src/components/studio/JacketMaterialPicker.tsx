"use client";

import { FABRIC_OPTIONS, WASH_OPTIONS, type FabricKind } from "./jacketMaterials";

interface JacketMaterialPickerProps {
  fabric: FabricKind;
  onFabricChange: (fabric: FabricKind) => void;
  washId: string;
  onWashChange: (washId: string) => void;
}

export function JacketMaterialPicker({
  fabric,
  onFabricChange,
  washId,
  onWashChange,
}: JacketMaterialPickerProps) {
  return (
    <div className="space-y-6">
      <div>
        <p className="label-eyebrow text-ink/50 mb-3">Fabric</p>
        <div className="flex flex-wrap gap-2">
          {FABRIC_OPTIONS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onFabricChange(f.id)}
              aria-pressed={fabric === f.id}
              title={f.description}
              className={`border px-3 py-2 text-xs uppercase tracking-wide transition-colors ${
                fabric === f.id
                  ? "border-ink bg-ink text-paper"
                  : "border-line text-ink/70 hover:border-ink/50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="label-eyebrow text-ink/50 mb-3">Wash / Color</p>
        <div className="flex flex-wrap gap-3">
          {WASH_OPTIONS.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => onWashChange(w.id)}
              aria-pressed={washId === w.id}
              aria-label={w.label}
              title={w.label}
              className={`h-9 w-9 rounded-full border-2 transition-transform ${
                washId === w.id ? "border-ink scale-110" : "border-line/60 hover:scale-105"
              }`}
              style={{ backgroundColor: w.hex }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
