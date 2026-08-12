import * as React from "react";
import { cn } from "@/lib/utils/cn";

function Table({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<"table"> & { containerClassName?: string }) {
  return (
    <div
      data-slot="table-wrap"
      className={cn(
        "w-full max-w-full overflow-x-auto overscroll-x-contain rounded-xl border border-border/80 bg-card shadow-sm shadow-black/2 [-webkit-overflow-scrolling:touch]",
        containerClassName
      )}
    >
      <table
        className={cn("w-full min-w-max caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead className={cn("bg-muted/60 [&_tr]:border-b", className)} {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      className={cn(
        "border-b border-border transition-colors hover:bg-muted/40",
        className
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "h-10 px-2.5 text-left align-middle text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:h-11 sm:px-3 sm:text-xs",
        className
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      className={cn(
        "px-2.5 py-2.5 align-middle text-sm sm:px-3 sm:py-3",
        className
      )}
      {...props}
    />
  );
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
