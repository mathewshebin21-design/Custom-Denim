"use client";

import { useState } from "react";
import { JacketViewer3D } from "./JacketViewer3D";
import { JacketMaterialPicker } from "./JacketMaterialPicker";
import { DEFAULT_FABRIC, DEFAULT_WASH_ID, type FabricKind } from "./jacketMaterials";

export function JacketConfigurator() {
  const [fabric, setFabric] = useState<FabricKind>(DEFAULT_FABRIC);
  const [washId, setWashId] = useState<string>(DEFAULT_WASH_ID);

  return (
    <div className="flex flex-col gap-8 md:flex-row md:items-start">
      <JacketViewer3D fabric={fabric} washId={washId} />
      <div className="md:w-64">
        <JacketMaterialPicker
          fabric={fabric}
          onFabricChange={setFabric}
          washId={washId}
          onWashChange={setWashId}
        />
      </div>
    </div>
  );
}
