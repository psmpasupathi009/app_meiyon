type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
};

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-4 flex flex-col gap-3 border-b border-border/70 pb-3.5 sm:mb-6 sm:gap-4 sm:pb-5 md:mb-8 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0 flex-1 space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-navy sm:text-2xl md:text-[1.75rem]">
          {title}
        </h1>
        {description ? (
          <p className="line-clamp-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:line-clamp-none">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center md:w-auto md:justify-end [&_button]:w-full sm:[&_button]:w-auto [&_a]:w-full sm:[&_a]:w-auto">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
