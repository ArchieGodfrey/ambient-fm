import type { CSSProperties } from "react";

// Shared, minimal style primitives for the app shell.

export const screen: CSSProperties = {
  padding: "28px 20px 160px",
  minHeight: "100svh",
  display: "flex",
  flexDirection: "column",
  gap: 24,
  color: "var(--text)",
};

export const screenEyebrow: CSSProperties = {
  fontSize: 12,
  letterSpacing: 2,
  textTransform: "uppercase",
  color: "var(--text-faint)",
  fontWeight: 600,
};

export const screenTitle: CSSProperties = {
  fontSize: 30,
  letterSpacing: -0.6,
  lineHeight: 1.1,
  color: "var(--text-h)",
};

export const card: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: 18,
  boxShadow: "var(--shadow-soft)",
};

export const sectionLabel: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text-muted)",
  letterSpacing: 0.2,
};

export const primaryButton: CSSProperties = {
  border: "none",
  borderRadius: "var(--radius-pill)",
  background: "var(--accent)",
  color: "#fff",
  fontSize: 15,
  fontWeight: 600,
  padding: "14px 22px",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  boxShadow: "var(--shadow)",
};

export const ghostButton: CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-pill)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 14,
  fontWeight: 500,
  padding: "10px 16px",
  cursor: "pointer",
};

export const chip: CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-pill)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 13,
  padding: "8px 14px",
  cursor: "pointer",
};

export const mutedNote: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: 14,
  lineHeight: 1.6,
};
