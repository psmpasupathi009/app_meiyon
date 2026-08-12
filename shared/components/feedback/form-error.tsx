import { cn } from "@/lib/utils/cn";

type FormErrorProps = {
  children: React.ReactNode;
  className?: string;
  id?: string;
};

/** Accessible inline form / dialog error message. */
export function FormError({ children, className, id }: FormErrorProps) {
  if (!children) return null;
  return (
    <p
      id={id}
      role="alert"
      className={cn("text-sm text-destructive", className)}
    >
      {children}
    </p>
  );
}
