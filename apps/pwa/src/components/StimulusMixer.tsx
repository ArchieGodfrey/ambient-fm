import type { StimulusConfig } from "../stimulus/types";

type StimulusMixerProps = {
  configs: StimulusConfig[];
  onToggleEnabled: (id: string, enabled: boolean) => void;
  onUpdateWeight: (id: string, userWeight: number) => void;
};

const descriptions: Record<string, string> = {
  time: "How much the time of day shapes the composition mood.",
  weather: "How much the weather conditions influence energy and tone.",
  manual: "How strongly mood input impacts the composer.",
};

export default function StimulusMixer({ configs, onToggleEnabled, onUpdateWeight }: StimulusMixerProps) {
  return (
    <div style={{ display: "grid", gap: 18 }}>
      {configs.map((config) => (
        <div key={config.id} style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 700 }}>{config.label}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{descriptions[config.id] ?? "Adjust the influence of this input."}</div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(event) => onToggleEnabled(config.id, event.target.checked)}
              />
              Enabled
            </label>
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)" }}>
              <span>Weight</span>
              <span>{Math.round(config.userWeight * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={config.userWeight}
              onChange={(event) => onUpdateWeight(config.id, Number(event.target.value))}
              style={{ width: "100%" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
