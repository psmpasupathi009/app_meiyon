import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils/cn";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-brand text-brand-foreground hover:brightness-110 dark:hover:brightness-125",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background text-foreground hover:bg-muted",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "text-foreground hover:bg-muted",
        link: "text-navy underline-offset-4 hover:underline",
        gold: "bg-gold text-gold-foreground hover:brightness-95 dark:hover:brightness-110",
        /* For use on brand / navy panels */
        "on-brand":
          "border border-white/30 bg-transparent text-white hover:bg-white/12 hover:text-white",
        "on-brand-solid":
          "border-0 bg-white text-brand hover:bg-white/90",
      },
      size: {
        default: "h-10 px-4 py-2 sm:h-9",
        sm: "h-10 rounded-md px-3 sm:h-8",
        lg: "h-11 rounded-md px-6 sm:h-10",
        icon: "size-10 sm:size-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
