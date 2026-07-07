// Light / dark / system theme. "system" follows prefers-color-scheme (no
// data-theme attribute); "light"/"dark" force it via :root[data-theme].
export type Theme = "light" | "dark" | "system";
const KEY = "ambientfm-theme";

export function getTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    if (t === "light" || t === "dark" || t === "system") return t;
  } catch { /* ignore */ }
  return "system";
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

export function setTheme(theme: Theme): void {
  try { localStorage.setItem(KEY, theme); } catch { /* ignore */ }
  applyTheme(theme);
}
