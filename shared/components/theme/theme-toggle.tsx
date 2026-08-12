"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/hooks/use-hydrated";

/**
 * Cycles system → light → dark so first-time visitors can override OS preference.
 */
export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const mounted = useHydrated();

  // Stable placeholder size before hydrate — avoids layout jump / wrong icon flash
  if (!mounted) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="shrink-0"
        aria-label="Toggle theme"
        disabled
      >
        <Moon className="size-4 opacity-40" />
      </Button>
    );
  }

  const isDark = resolvedTheme === "dark";
  const next =
    theme === "system" ? "light" : theme === "light" ? "dark" : "system";
  const label =
    next === "light"
      ? "Switch to light mode"
      : next === "dark"
        ? "Switch to dark mode"
        : "Use system theme";
  const title =
    theme === "system"
      ? "Theme: system"
      : theme === "light"
        ? "Theme: light"
        : "Theme: dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="shrink-0 text-navy hover:bg-muted hover:text-navy"
      aria-label={label}
      title={title}
      onClick={() => setTheme(next)}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
