import { useState } from "react";
import HomePage from "./pages/HomePage";
import MoodPage from "./pages/MoodPage";
import SessionsPage from "./pages/SessionsPage";
import CurrentSessionBar from "./components/CurrentSessionBar";
import Toasts from "./components/Toasts";
import useToastEvents from "./hooks/useToastEvents";

const tabs = [
  { key: "dashboard", label: "Now" },
  { key: "mood", label: "Mood" },
  { key: "sessions", label: "Sessions" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const toasts = useToastEvents();

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 120, background: "var(--bg)" }}>
      <CurrentSessionBar />
      <Toasts toasts={toasts} />
      <div style={{ position: "relative" }}>
        <div style={{ display: activeTab === "dashboard" ? "block" : "none" }}>
          <HomePage />
        </div>
        <div style={{ display: activeTab === "mood" ? "block" : "none" }}>
          <MoodPage />
        </div>
        <div style={{ display: activeTab === "sessions" ? "block" : "none" }}>
          <SessionsPage />
        </div>
      </div>
      <nav
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          height: 55,
          borderTop: "1px solid var(--border)",
          background: "var(--surface-strong)",
          backdropFilter: "blur(12px)",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          maxWidth: 720,
          margin: "0 auto",
        }}
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            style={{
              border: "none",
              borderRight: index < tabs.length - 1 ? "1px solid var(--border)" : "none",
              background: activeTab === tab.key ? "var(--surface)" : "transparent",
              color: activeTab === tab.key ? "var(--text-h)" : "var(--text-muted)",
              fontWeight: activeTab === tab.key ? 700 : 500,
              fontSize: 13,
              height: "100%",
              margin: 0,
              cursor: "pointer",
              outline: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "12px 0 28px",
              boxSizing: "border-box",
            }}
          >
            <span style={{
              borderBottom: activeTab === tab.key ? "2px solid var(--text-h)" : "2px solid transparent",
              paddingBottom: 4,
            }}>
              {tab.label}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}
