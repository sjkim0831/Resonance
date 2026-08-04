import { useEffect, useState } from "react";
import { assertFiveLayerContract, type FiveLayerScreenContract } from "./fiveLayerContract";

type RuntimeEnvelope = { contract?: unknown; versionId?: number; contractHash?: string };

function rendererContract(value: unknown): FiveLayerScreenContract | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const candidate = (raw.renderer && typeof raw.renderer === "object" ? raw.renderer : raw) as FiveLayerScreenContract;
  try {
    return assertFiveLayerContract(candidate);
  } catch {
    return null;
  }
}

export function useRuntimeScreenContract(screenKey: string, fallback: FiveLayerScreenContract) {
  const [contract, setContract] = useState(fallback);
  const [source, setSource] = useState<"fallback" | "runtime">("fallback");

  useEffect(() => {
    let active = true;
    fetch(`/runtime/screens/${encodeURIComponent(screenKey)}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<RuntimeEnvelope>;
      })
      .then((envelope) => {
        const next = rendererContract(envelope.contract);
        if (active && next) {
          setContract(next);
          setSource("runtime");
        }
      })
      .catch(() => {
        if (active) {
          setContract(fallback);
          setSource("fallback");
        }
      });
    return () => { active = false; };
  }, [fallback, screenKey]);

  return { contract, source };
}

