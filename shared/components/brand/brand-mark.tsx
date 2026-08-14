import { brand } from "@/config/company/brand";
import { cn } from "@/lib/utils/cn";

const SIZES = {
  sm: { box: "size-8" },
  md: { box: "size-14" },
  /** Login hero — compact on phone, large from md up */
  lg: {
    box: "size-12 sm:size-14 md:size-40 lg:size-52 xl:size-56",
  },
} as const;

type BrandMarkProps = {
  size?: keyof typeof SIZES;
  className?: string;
  /** Decorative when parent already names the brand (e.g. sidebar). */
  decorative?: boolean;
  priority?: boolean;
};

/**
 * MEIYON letter mark — navy disk for light and dark surfaces.
 */
export function BrandMark({
  size = "sm",
  className,
  decorative = false,
}: BrandMarkProps) {
  const { box } = SIZES[size];

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--navy,#0f2744)] font-bold text-white ring-1 ring-border dark:shadow-sm",
        box,
        className
      )}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : brand.name}
    >
      M
    </span>
  );
}
