import { useState } from "react";
import HomePage from "./pages/HomePage";
import MoodPage from "./pages/MoodPage";
import SessionsPage from "./pages/SessionsPage";
import SettingsPage from "./pages/SettingsPage";
import CurrentSessionBar from "./components/CurrentSessionBar";
import Toasts from "./components/Toasts";
import useToastEvents from "./hooks/useToastEvents";

const MAIN_TABS = ["now", "mood", "sessions"] as const;
type TabKey = "now" | "mood" | "sessions" | "settings";
const TAB_LABELS: Record<string, string> = { now: "Now", mood: "Mood", sessions: "Sessions" };

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("now");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const toasts = useToastEvents();
  const openMenu = () => setDrawerOpen(true);
  const closeMenu = () => setDrawerOpen(false);
  const goTo = (tab: TabKey) => { setActiveTab(tab); closeMenu(); };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Backdrop */}
      {drawerOpen && (
        <div onClick={closeMenu} style={{
          position: "fixed", inset: 0, zIndex: 40,
          background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)",
        }} />
      )}

      {/* Drawer */}
      <aside style={{
        position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 50,
        width: 240, background: "var(--surface-strong)",
        borderLeft: "1px solid var(--border)",
        transform: drawerOpen ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.22s ease",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 16px 16px", borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Ambient FM</span>
          <button type="button" onClick={closeMenu} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 18, padding: 4 }}>✕</button>
        </div>
        <nav style={{ padding: "12px 8px", flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          {MAIN_TABS.map(tab => (
            <button key={tab} type="button" onClick={() => goTo(tab)} style={{
              padding: "11px 14px", borderRadius: 10, border: "none", cursor: "pointer",
              textAlign: "left", fontSize: 14,
              background: activeTab === tab ? "var(--accent-bg)" : "transparent",
              color: activeTab === tab ? "var(--accent)" : "var(--text)",
              fontWeight: activeTab === tab ? 600 : 400,
            }}>{TAB_LABELS[tab]}</button>
          ))}
          <div style={{ height: 1, background: "var(--border)", margin: "8px 0" }} />
          <button type="button" onClick={() => goTo("settings")} style={{
            padding: "11px 14px", borderRadius: 10, border: "none", cursor: "pointer",
            textAlign: "left", fontSize: 14,
            background: activeTab === "settings" ? "var(--accent-bg)" : "transparent",
            color: activeTab === "settings" ? "var(--accent)" : "var(--text-muted)",
          }}>⚙ Settings &amp; Debug</button>
        </nav>
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", fontSize: 11, color: "var(--text-muted)" }}>Ambient FM</div>
      </aside>

      <CurrentSessionBar />
      <Toasts toasts={toasts} />

      <div>
        <div style={{ display: activeTab === "now"      ? "block" : "none" }}><HomePage onOpenMenu={openMenu} /></div>
        <div style={{ display: activeTab === "mood"     ? "block" : "none" }}><MoodPage /></div>
        <div style={{ display: activeTab === "sessions" ? "block" : "none" }}><SessionsPage /></div>
        <div style={{ display: activeTab === "settings" ? "block" : "none" }}><SettingsPage /></div>
      </div>

      <nav style={{
        position: "fixed", left: 0, right: 0, bottom: 0, height: 55,
        borderTop: "1px solid var(--border)", background: "var(--surface-strong)",
        backdropFilter: "blur(12px)", display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)", maxWidth: 720, margin: "0 auto",
      }}>
        {MAIN_TABS.map((tab, i) => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)} style={{
            border: "none", borderRight: i < 2 ? "1px solid var(--border)" : "none",
            background: activeTab === tab ? "var(--surface)" : "transparent",
            color: activeTab === tab ? "var(--text-h)" : "var(--text-muted)",
            fontWeight: activeTab === tab ? 700 : 500,
            fontSize: 13, height: "100%", cursor: "pointer", outline: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "12px 0 28px", boxSizing: "border-box",
          }}>
            <span style={{ borderBottom: activeTab === tab ? "2px solid var(--text-h)" : "2px solid transparent", paddingBottom: 4 }}>
              {TAB_LABELS[tab]}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}
