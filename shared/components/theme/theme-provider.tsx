"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * next-themes injects an inline <script> to avoid theme flash.
 * React 19 / Next 16 warn when a script is rendered from a client component.
 * Keep the real script on SSR; on the client pass a non-JS type so React
 * does not treat it as an executable script tag.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scriptProps =
    typeof window === "undefined"
      ? undefined
      : ({ type: "application/json" } as const);

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="mlf-theme"
      disableTransitionOnChange
      scriptProps={scriptProps}
    >
      {children}
    </NextThemesProvider>
  );
}
