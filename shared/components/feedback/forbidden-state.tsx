import Link from "next/link";
import { Button } from "@/components/ui/button";

export function ForbiddenState() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <h1 className="text-2xl font-semibold text-navy">You don’t have access</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Ask an admin to update your roles or the permission matrix.
      </p>
      <Button asChild className="mt-6">
        <Link href="/">Back to home</Link>
      </Button>
    </div>
  );
}
