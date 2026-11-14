import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../lib/theme";

// Sun while dark (tap for light), moon while light (tap for dark).
export default function ThemeToggle({ className = "" }) {
  const [theme, setTheme] = useTheme();
  const next = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      title={`Switch to ${next} mode`}
      aria-label={`Switch to ${next} mode`}
      className={`w-9 h-9 rounded-lg bg-[color:var(--tl-raised)] border border-[color:var(--tl-line)] flex items-center justify-center cursor-pointer text-[color:var(--tl-tx-3)] hover:border-[color:var(--tl-line-strong)] hover:text-[color:var(--tl-tx-2)] transition-colors ${className}`}
    >
      {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}