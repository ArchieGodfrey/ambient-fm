import { useEffect, useState } from "react";
import { Radio, Library, SlidersHorizontal, Settings as SettingsIcon } from "lucide-react";
import { SessionProvider } from "./session/SessionProvider";
import RadioScreen from "./screens/Radio";
import Journey from "./screens/Journey";
import YourSound from "./screens/YourSound";
import Settings from "./screens/Settings";
import CurrentSessionBar from "./components/CurrentSessionBar";
import NowPlaying from "./components/NowPlaying";
import DebugLog from "./components/DebugLog";
import InstallGate from "./components/InstallGate";
import SetupWizard from "./components/SetupWizard";
import WorkloadTint from "./components/WorkloadTint";
import { isStandalone, isOnboarded, isSetupDone } from "./utils/install";
import { useAppStore } from "./store/useAppStore";

type OnboardingPhase = "install" | "setup" | "app";

const tabs = [
  { key: "radio", label: "Radio", Icon: Radio, Screen: RadioScreen },
  { key: "journey", label: "Library", Icon: Library, Screen: Journey },
  { key: "sound", label: "Your Sound", Icon: SlidersHorizontal, Screen: YourSound },
  { key: "settings", label: "Settings", Icon: SettingsIcon, Screen: Settings },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export default function App() {
  const [active, setActive] = useState<TabKey>("radio");
  const [expanded, setExpanded] = useState(false);
  const debug = useAppStore((s) => s.debug);
  const ActiveScreen = tabs.find((t) => t.key === active)!.Screen;

  // First run: show the install soft-wall (unless already installed/dismissed),
  // then the setup wizard, then the app. Settings can re-open the wizard.
  const [phase, setPhase] = useState<OnboardingPhase>(() => {
    if (!isStandalone() && !isOnboarded()) return "install";
    if (!isSetupDone()) return "setup";
    return "app";
  });
  useEffect(() => {
    const open = () => setPhase("setup");
    window.addEventListener("afm-open-setup", open);
    return () => window.removeEventListener("afm-open-setup", open);
  }, []);

  return (
    <SessionProvider>
      <WorkloadTint />
      {phase === "install" ? (
        <InstallGate onContinue={() => setPhase(isSetupDone() ? "app" : "setup")} />
      ) : phase === "setup" ? (
        <SetupWizard onDone={() => setPhase("app")} />
      ) : null}
      {debug ? <DebugLog /> : null}
      {expanded ? <NowPlaying onClose={() => setExpanded(false)} /> : null}
      <main className="afm-main">
        <ActiveScreen />
      </main>

      <CurrentSessionBar onExpand={() => setExpanded(true)} />

      <nav className="afm-nav">
        <div className="afm-nav-inner">
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
        </div>
      </nav>
    </SessionProvider>
  );
}
