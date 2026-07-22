import Image from "next/image";
import { BRAND } from "@/lib/brand";

/** Site logo — always links to the public Dental Scotland homepage. */
export default function BrandLogo({
  height = 40,
  width = 150,
  priority = false,
}: {
  height?: number;
  width?: number;
  priority?: boolean;
}) {
  return (
    <a
      href={BRAND.url}
      target="_blank"
      rel="noopener noreferrer"
      title={`${BRAND.name} — ${BRAND.tagline}`}
      aria-label={`${BRAND.name} website`}
      style={{ display: "inline-flex", alignItems: "center", lineHeight: 0, textDecoration: "none" }}
    >
      <Image
        src="/logo.webp"
        alt={BRAND.name}
        width={width}
        height={height}
        priority={priority}
        style={{ height, width: "auto" }}
      />
    </a>
  );
}
