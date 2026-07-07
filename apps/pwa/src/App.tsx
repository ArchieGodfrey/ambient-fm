import { useState } from "react";
import { Disc3, Library, SlidersHorizontal, Settings as SettingsIcon } from "lucide-react";
import { SessionProvider } from "./session/SessionProvider";
import Today from "./screens/Today";
import Journey from "./screens/Journey";
import YourSound from "./screens/YourSound";
import Settings from "./screens/Settings";
import CurrentSessionBar from "./components/CurrentSessionBar";

const tabs = [
  { key: "today", label: "Today", Icon: Disc3, Screen: Today },
  { key: "journey", label: "Library", Icon: Library, Screen: Journey },
  { key: "sound", label: "Your Sound", Icon: SlidersHorizontal, Screen: YourSound },
  { key: "settings", label: "Settings", Icon: SettingsIcon, Screen: Settings },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export default function App() {
  const [active, setActive] = useState<TabKey>("today");
  const ActiveScreen = tabs.find((t) => t.key === active)!.Screen;

  return (
    <SessionProvider>
      <main style={{ minHeight: "100svh", background: "var(--bg)" }}>
        <ActiveScreen />
      </main>

      <CurrentSessionBar />

      <nav
        style={{
          position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 30,
          height: 64, maxWidth: 480, margin: "0 auto",
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
          background: "color-mix(in srgb, var(--surface-strong) 82%, transparent)",
          backdropFilter: "blur(14px)", borderTop: "1px solid var(--border)",
        }}
      >
        {tabs.map(({ key, label, Icon }) => {
          const on = key === active;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActive(key)}
              style={{
                border: "none", background: "transparent", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
                color: on ? "var(--accent)" : "var(--text-faint)",
                fontSize: 10.5, fontWeight: on ? 600 : 500, letterSpacing: 0.2, padding: 0,
                transition: "color 0.2s ease",
              }}
            >
              <Icon size={20} strokeWidth={on ? 2.4 : 2} />
              {label}
            </button>
          );
        })}
      </nav>
    </SessionProvider>
  );
}
