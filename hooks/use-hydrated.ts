"use client";

import { useSyncExternalStore } from "react";

/** True after client hydration — stable SSR-safe alternative to setMounted(true) in an effect. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}
