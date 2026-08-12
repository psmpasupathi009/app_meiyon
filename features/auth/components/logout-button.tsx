"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { performLogout } from "@/features/auth/lib/perform-logout";

/** Standalone logout control — prefer UserMenu in the portal header. */
export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    if (loading) return;
    setLoading(true);
    await performLogout(router);
    setLoading(false);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleLogout}
      disabled={loading}
      className="gap-2 text-muted-foreground hover:text-navy"
    >
      <LogOut className="size-4" />
      <span className="hidden sm:inline">
        {loading ? "Signing out…" : "Logout"}
      </span>
    </Button>
  );
}
