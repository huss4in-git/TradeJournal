import { useEffect, useState } from "react";

// Light / dark preference. Stored per browser, like the date range, so your
// phone and your brother's each keep their own. Dark until you choose light.
//
// The theme itself is plain CSS: this file only sets data-theme on <html>,
// and src/theme.css swaps the colour variables to match.
const KEY = "tradelog:theme";

// Colour of the browser / phone status bar, matched to the page background.
const THEME_COLOR = { dark: "#0A0A0B", light: "#F4F5F7" };

const read = () => {
  try {
    return localStorage.getItem(KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark"; // private browsing can throw
  }
};

function apply(theme) {
  document.documentElement.dataset.theme = theme;

  let metas = document.querySelectorAll('meta[name="theme-color"]');
  if (!metas.length) {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
    metas = [meta];
  }
  metas.forEach((m) => m.setAttribute("content", THEME_COLOR[theme]));
}

let current = read();
const listeners = new Set();

// Runs as soon as this file is imported — before React renders anything —
// so the page never paints in the wrong theme first.
apply(current);

export function getTheme() {
  return current;
}

export function setTheme(theme) {
  current = theme === "light" ? "light" : "dark";
  try {
    localStorage.setItem(KEY, current);
  } catch {
    // Still switches for this visit; it just won't be remembered.
  }
  apply(current);
  listeners.forEach((fn) => fn(current));
}

// Switching in one tab switches every other open tab too.
window.addEventListener("storage", (e) => {
  if (e.key !== KEY) return;
  current = read();
  apply(current);
  listeners.forEach((fn) => fn(current));
});

// const [theme, setTheme] = useTheme();
export function useTheme() {
  const [theme, setLocal] = useState(current);

  useEffect(() => {
    listeners.add(setLocal);
    setLocal(current);
    return () => listeners.delete(setLocal);
  }, []);

  return [theme, setTheme];
}