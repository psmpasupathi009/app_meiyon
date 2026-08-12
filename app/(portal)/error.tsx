"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-16">
      <h2 className="text-xl font-semibold text-navy">Something went wrong</h2>
      <p className="text-sm text-muted-foreground">Please try again.</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
