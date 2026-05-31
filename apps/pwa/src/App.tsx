import { useState } from "react";
import HomePage from "./pages/HomePage";
import TimelinePage from "./pages/TimelinePage";
import SessionsPage from "./pages/SessionsPage";

const tabs = [
  { key: "dashboard", label: "Now" },
  { key: "timeline", label: "Timeline" },
  { key: "sessions", label: "Sessions" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");

  function renderPage() {
    if (activeTab === "timeline") {
      return <TimelinePage />;
    }
    if (activeTab === "sessions") {
      return <SessionsPage />;
    }
    return <HomePage />;
  }

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 120, background: "#fff" }}>
      {renderPage()}
      <nav
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          height: 55,
          borderTop: "1px solid rgba(0,0,0,0.08)",
          background: "rgba(255,255,255,0.98)",
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
              borderRight: index < tabs.length - 1 ? "1px solid rgba(0,0,0,0.08)" : "none",
              background: activeTab === tab.key ? "rgba(0,0,0,0.05)" : "transparent",
              color: activeTab === tab.key ? "#111" : "#555",
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
              borderBottom: activeTab === tab.key ? "2px solid #111" : "2px solid transparent",
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
