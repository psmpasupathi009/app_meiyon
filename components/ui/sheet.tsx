"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetPortal = DialogPrimitive.Portal;

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-brand/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = "left",
  showClose = true,
  size = "nav",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  side?: "left" | "right";
  showClose?: boolean;
  /** nav = slim sidebar; detail = full-width on phones, capped on desktop */
  size?: "nav" | "detail";
}) {
  const isDetail = size === "detail";
  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 flex h-dvh flex-col gap-0 border-border bg-card shadow-xl outline-none",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          side === "left" &&
            !isDetail &&
            "inset-y-0 left-0 w-[min(17rem,90vw)] border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
          side === "right" &&
            !isDetail &&
            "inset-y-0 right-0 w-[min(17rem,90vw)] border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
          side === "right" &&
            isDetail &&
            "inset-y-0 right-0 w-full border-l pb-[env(safe-area-inset-bottom)] data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-md lg:max-w-lg",
          side === "left" &&
            isDetail &&
            "inset-y-0 left-0 w-full border-r pb-[env(safe-area-inset-bottom)] data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-md lg:max-w-lg",
          className
        )}
        {...props}
      >
        {children}
        {showClose ? (
          <DialogPrimitive.Close className="absolute top-[max(0.5rem,env(safe-area-inset-top))] right-2 z-20 inline-flex size-10 items-center justify-center rounded-md text-muted-foreground opacity-80 transition-opacity hover:bg-muted hover:opacity-100 focus:outline-none">
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "shrink-0 border-b border-border px-4 py-4 pr-12 pt-[max(1rem,env(safe-area-inset-top))]",
        className
      )}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("text-sm font-semibold text-navy", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetPortal,
  SheetOverlay,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
};
