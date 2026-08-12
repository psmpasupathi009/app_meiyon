"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;
const DialogPortal = DialogPrimitive.Portal;

export type DialogContentSize = "sm" | "md" | "lg";

const DIALOG_SIZE_CLASSES: Record<DialogContentSize, string> = {
  /** Short confirms / small forms — larger than old max-w-lg */
  sm: [
    "w-[calc(100dvw-1rem)] max-w-xl",
    "max-h-[min(90dvh,calc(100dvh-1rem))]",
  ].join(" "),
  /** Medium forms (appointment, import, upload) */
  md: [
    "w-[calc(100dvw-1rem)] max-w-3xl",
    "max-h-[min(92dvh,calc(100dvh-1rem))]",
  ].join(" "),
  /** Large multi-section registers (client, employee, case) */
  lg: [
    "w-[calc(100dvw-1rem)] max-w-[min(1440px,calc(100dvw-1rem))]",
    "h-auto max-h-[min(92dvh,calc(100dvh-1rem))]",
    "md:h-[min(92dvh,calc(100dvh-1rem))]",
  ].join(" "),
};

function DialogOverlay({
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

/**
 * Shell: responsive viewport-safe size, no page overflow.
 * Use DialogHeader + DialogBody + DialogFooter inside.
 * Large forms may pass className="p-0" and their own scroll region.
 */
function DialogContent({
  className,
  overlayClassName,
  children,
  size = "sm",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  size?: DialogContentSize;
  /**
   * Raise overlay + content together when nesting dialogs
   * (e.g. client intake from a form). Must apply to both — overlay-only
   * elevation blocks clicks/typing on the form.
   */
  overlayClassName?: string;
}) {
  return (
    <DialogPortal>
      <DialogOverlay className={overlayClassName} />
      <DialogPrimitive.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 flex min-h-0 w-full max-w-[calc(100dvw-1rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-0 overflow-hidden rounded-xl border border-border bg-card p-0 shadow-lg",
          // Keep content at/above overlay when callers pass e.g. z-[60]
          overlayClassName,
          DIALOG_SIZE_CLASSES[size],
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute top-2 right-2 z-20 inline-flex size-10 items-center justify-center rounded-md text-muted-foreground opacity-80 transition-opacity hover:bg-muted hover:opacity-100 focus:outline-none sm:top-2.5 sm:right-2.5">
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "shrink-0 space-y-1 border-b border-border/80 px-4 py-3 pr-11 text-left sm:px-5 sm:py-4 sm:pr-12",
        className
      )}
      {...props}
    />
  );
}

/** Scrollable middle — keeps header/footer fixed and prevents overlay overflow. */
function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-3 sm:px-5 sm:py-4",
        className
      )}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex w-full shrink-0 flex-col-reverse gap-2 border-t border-border/80 bg-card px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-5 [&_button]:w-full sm:[&_button]:w-auto",
        className
      )}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("text-base font-semibold text-navy sm:text-lg", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("text-xs text-muted-foreground sm:text-sm", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
