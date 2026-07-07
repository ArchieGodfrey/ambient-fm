import { useState, type CSSProperties } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useAppStore } from "../store/useAppStore";

export default function DebugLog() {
  const logs = useAppStore((s) => s.logs);
  const clearLogs = useAppStore((s) => s.clearLogs);
  const [collapsed, setCollapsed] = useState(false);

  const errors = logs.filter((l) => l.level === "error").length;
  const warns = logs.length - errors;

  return (
    <div
      style={{
        position: "fixed", top: 10, right: 10, left: "auto", zIndex: 40,
        width: "min(440px, calc(100vw - 20px))",
        background: "color-mix(in srgb, var(--surface-strong) 96%, transparent)",
        border: "1px solid var(--border)", borderRadius: "var(--radius)",
        boxShadow: "var(--shadow)", backdropFilter: "blur(10px)", overflow: "hidden",
        fontFamily: "var(--mono)", fontSize: 11.5,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 10px", background: "var(--surface-muted)", borderBottom: collapsed ? "none" : "1px solid var(--border)" }}>
        <span style={{ fontWeight: 700, color: "var(--text-h)", letterSpacing: 0.3 }}>
          Debug log
          <span style={{ color: "var(--text-muted)", fontWeight: 500 }}> · {warns}w {errors}e</span>
        </span>
        <span style={{ display: "flex", gap: 4 }}>
          <button type="button" onClick={() => clearLogs()} title="Clear" style={iconBtn}>clear</button>
          <button type="button" onClick={() => setCollapsed((c) => !c)} title="Collapse" style={{ ...iconBtn, padding: 4 }}>
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </span>
      </div>
      {!collapsed ? (
        <div style={{ maxHeight: "42vh", overflowY: "auto", padding: "6px 0" }}>
          {logs.length === 0 ? (
            <div style={{ padding: "10px 12px", color: "var(--text-faint)" }}>No warnings or errors yet.</div>
          ) : (
            logs.slice().reverse().map((l, i) => (
              <div key={i} style={{ display: "flex", gap: 8, padding: "4px 12px", borderBottom: "1px solid color-mix(in srgb, var(--border) 40%, transparent)" }}>
                <span style={{ flexShrink: 0, color: l.level === "error" ? "#e06a86" : "#d9a441", fontWeight: 700, textTransform: "uppercase" }}>{l.level === "error" ? "err" : "warn"}</span>
                <span style={{ color: "var(--text)", wordBreak: "break-word", flex: 1 }}>{l.message}</span>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

const iconBtn: CSSProperties = {
  border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-muted)",
  borderRadius: 8, padding: "3px 8px", cursor: "pointer", fontSize: 11, fontFamily: "var(--mono)",
  display: "inline-flex", alignItems: "center",
};
