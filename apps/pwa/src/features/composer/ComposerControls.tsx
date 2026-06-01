import { useCallback } from "react";
import { useAppStore } from "../../store/useAppStore";
import type { ComposerSettings } from "./types";

const LABELS: Record<keyof ComposerSettings, string> = {
  complexity: "Complexity",
  motifDensity: "Motif Density",
  harmonicMovement: "Harmonic Movement",
};

export default function ComposerControls() {
  const composerSettings = useAppStore((state) => state.composerSettings);
  const setComposerSettings = useAppStore((state) => state.setComposerSettings);

  const handleChange = useCallback(
    (key: keyof ComposerSettings, value: number) => {
      setComposerSettings({
        ...composerSettings,
        [key]: value,
      });
    },
    [composerSettings, setComposerSettings],
  );

  return (
    <div className="mood-page__composer-controls">
      <div className="mood-page__strength-grid">
        {(Object.keys(LABELS) as Array<keyof ComposerSettings>).map((key) => (
          <div key={key} className="mood-page__range-row">
            <div className="mood-page__range-heading">
              <span>{LABELS[key]}</span>
              <span>{Math.round(composerSettings[key] * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={composerSettings[key]}
              onChange={(event) => handleChange(key, Number(event.target.value))}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
