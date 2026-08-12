import Image from "next/image";
import { brand } from "@/config/company/brand";
import { cn } from "@/lib/utils/cn";

const SIZES = {
  sm: { box: "size-8", px: 32 },
  md: { box: "size-14", px: 56 },
  /** Login hero — compact on phone, large from md up */
  lg: {
    box: "size-12 sm:size-14 md:size-40 lg:size-52 xl:size-56",
    px: 224,
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
 * MLF logo disk — white circle framed for light and dark surfaces.
 */
export function BrandMark({
  size = "sm",
  className,
  decorative = false,
  priority = false,
}: BrandMarkProps) {
  const { box, px } = SIZES[size];

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-border dark:shadow-sm",
        box,
        className
      )}
    >
      <Image
        src={brand.logoSrc}
        alt={decorative ? "" : brand.name}
        width={px}
        height={px}
        className="size-full object-cover"
        priority={priority}
      />
    </span>
  );
}
