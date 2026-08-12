type EmptyStateProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** Smaller padding for use inside cards / panels. */
  compact?: boolean;
};

export function EmptyState({
  title,
  description,
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={
        compact
          ? "flex flex-col items-center justify-center px-5 py-10 text-center"
          : "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-20 text-center"
      }
    >
      {!compact ? (
        <div className="mb-4 h-1 w-10 rounded-full bg-gold/80" aria-hidden />
      ) : null}
      <h2
        className={
          compact
            ? "text-sm font-medium text-muted-foreground"
            : "text-lg font-semibold text-navy"
        }
      >
        {title}
      </h2>
      {description ? (
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
