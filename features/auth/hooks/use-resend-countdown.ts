"use client";

import { useEffect, useState } from "react";

export function useResendCountdown(seconds = 60) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (remaining <= 0) return;
    const id = window.setInterval(() => {
      setRemaining((value) => (value <= 1 ? 0 : value - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [remaining]);

  return {
    remaining,
    start: () => setRemaining(seconds),
    active: remaining > 0,
  };
}
