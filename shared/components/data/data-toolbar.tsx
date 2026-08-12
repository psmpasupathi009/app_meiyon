type DataToolbarProps = {
  search?: React.ReactNode;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
};

export function DataToolbar({ search, filters, actions }: DataToolbarProps) {
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-3 sm:p-3.5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
        {search ? (
          <div className="w-full min-w-0 md:max-w-sm md:flex-1">{search}</div>
        ) : null}
        {filters ? (
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center md:w-auto *:min-w-0 *:w-full sm:*:w-auto **:data-[slot=select-trigger]:w-full sm:**:data-[slot=select-trigger]:w-auto [&_button]:w-full sm:[&_button]:w-auto">
            {filters}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap lg:w-auto lg:justify-end [&_button]:w-full sm:[&_button]:w-auto [&_a]:w-full sm:[&_a]:w-auto">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
