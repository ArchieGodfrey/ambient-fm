import { useState } from "react";
import { Disc3, Library, SlidersHorizontal, Settings as SettingsIcon } from "lucide-react";
import { SessionProvider } from "./session/SessionProvider";
import Today from "./screens/Today";
import Journey from "./screens/Journey";
import YourSound from "./screens/YourSound";
import Settings from "./screens/Settings";
import CurrentSessionBar from "./components/CurrentSessionBar";
import NowPlaying from "./components/NowPlaying";
import DebugLog from "./components/DebugLog";
import { useAppStore } from "./store/useAppStore";

const tabs = [
  { key: "today", label: "Today", Icon: Disc3, Screen: Today },
  { key: "journey", label: "Library", Icon: Library, Screen: Journey },
  { key: "sound", label: "Your Sound", Icon: SlidersHorizontal, Screen: YourSound },
  { key: "settings", label: "Settings", Icon: SettingsIcon, Screen: Settings },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export default function App() {
  const [active, setActive] = useState<TabKey>("today");
  const [expanded, setExpanded] = useState(false);
  const debug = useAppStore((s) => s.debug);
  const ActiveScreen = tabs.find((t) => t.key === active)!.Screen;

  return (
    <SessionProvider>
      {debug ? <DebugLog /> : null}
      {expanded ? <NowPlaying onClose={() => setExpanded(false)} /> : null}
      <main className="afm-main">
        <ActiveScreen />
      </main>

      <CurrentSessionBar onExpand={() => setExpanded(true)} />

      <nav className="afm-nav">
        {tabs.map(({ key, label, Icon }) => {
          const on = key === active;
          return (
            <button
              key={key}
              type="button"
              data-active={on}
              onClick={() => setActive(key)}
              className="afm-nav-btn"
              style={{ color: on ? "var(--accent)" : "var(--text-faint)", fontWeight: on ? 600 : 500 }}
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
