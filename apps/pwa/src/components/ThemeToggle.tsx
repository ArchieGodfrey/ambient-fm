import { useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { getTheme, setTheme, type Theme } from "../utils/theme";
import { card } from "../ui/styles";

const OPTIONS: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

export default function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>(getTheme());

  const pick = (t: Theme) => { setTheme(t); setThemeState(t); };

  return (
    <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "center", gap: 14, padding: 10 }}>
      <div style={{ display: "inline-flex", gap: 4, background: "var(--surface-muted)", borderRadius: "var(--radius-pill)", padding: 3 }}>
        {OPTIONS.map(({ value, label, Icon }) => {
          const on = theme === value;
          return (
            <button key={value} type="button" onClick={() => pick(value)} aria-label={label} title={label}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: "var(--radius-pill)",
                border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
                background: on ? "var(--surface)" : "transparent",
                color: on ? "var(--accent)" : "var(--text-muted)",
                boxShadow: on ? "var(--shadow-soft)" : "none",
              }}>
              <Icon size={15} />{label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
