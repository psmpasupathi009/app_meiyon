"use client";

type AuthFilePreviewProps = {
  unitId: string;
  mimeType: string;
  title: string;
  className?: string;
};

/** Preview via authenticated download URL — never the raw Cloudinary link. */
export function AuthFilePreview({
  unitId,
  mimeType,
  title,
  className = "",
}: AuthFilePreviewProps) {
  const src = `/api/documents/${unitId}/download`;
  if (mimeType.startsWith("image/")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={title}
        className={`max-h-56 w-full rounded-lg border border-border/60 object-contain bg-zinc-50 ${className}`}
      />
    );
  }
  if (mimeType === "application/pdf") {
    return (
      <iframe
        src={src}
        title={title}
        className={`h-64 w-full rounded-lg border border-border/60 ${className}`}
      />
    );
  }
  return null;
}
