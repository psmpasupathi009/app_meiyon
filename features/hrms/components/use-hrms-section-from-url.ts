"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { DeskSection } from "@/features/hrms/components/hrms-page-helpers";

const SECTION_VALUES = new Set<DeskSection>([
  "today",
  "history",
  "leave",
  "holidays",
]);

/**
 * Reads ?section= / ?leave=1 / ?new=1 URL params into desk section state,
 * then clears them from the address bar. Re-runs when search params change
 * (e.g. notification deep-link while already on /hrms).
 */
export function useHrmsSectionFromUrl(canOwnLeave: boolean) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [section, setSection] = useState<DeskSection>("today");
  const [applyOpen, setApplyOpen] = useState(false);

  const sectionParam = searchParams.get("section");
  const leaveParam = searchParams.get("leave");
  const newParam = searchParams.get("new");

  useEffect(() => {
    const wantLeave = leaveParam === "1" || newParam === "1";
    const validSection =
      sectionParam && SECTION_VALUES.has(sectionParam as DeskSection)
        ? (sectionParam as DeskSection)
        : null;

    if (!validSection && !(wantLeave && canOwnLeave)) return;

    queueMicrotask(() => {
      if (wantLeave && canOwnLeave) {
        setSection("leave");
        setApplyOpen(true);
      } else if (validSection) {
        setSection(validSection);
      }

      const next = new URLSearchParams(searchParams.toString());
      next.delete("section");
      next.delete("leave");
      next.delete("new");
      const qs = next.toString();
      router.replace(qs ? `/hrms?${qs}` : "/hrms", { scroll: false });
    });
  }, [
    sectionParam,
    leaveParam,
    newParam,
    canOwnLeave,
    router,
    searchParams,
  ]);

  return { section, setSection, applyOpen, setApplyOpen };
}
