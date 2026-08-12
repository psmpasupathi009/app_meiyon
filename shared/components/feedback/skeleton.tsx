import { cn } from "@/lib/utils/cn";

type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-md bg-muted", className)}
    />
  );
}

type PageLoadingProps = {
  className?: string;
};

/** Default portal page loading skeleton. */
export function PageLoading({ className }: PageLoadingProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading"
      className={cn(
        "mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6",
        className
      )}
    >
      <Skeleton className="h-4 w-24 bg-border" />
      <Skeleton className="h-9 w-64 max-w-full bg-border" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28 rounded-xl bg-border" />
        <Skeleton className="h-28 rounded-xl bg-border" />
        <Skeleton className="h-28 rounded-xl bg-border" />
      </div>
    </div>
  );
}
