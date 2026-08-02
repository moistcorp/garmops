import Image from "next/image";

import { GARMOPS_BRAND } from "@/lib/brand";

export default function GarmopsLogo({
  className = "",
  inverted = false,
  preload = false,
}: {
  className?: string;
  inverted?: boolean;
  preload?: boolean;
}) {
  return (
    <Image
      src={GARMOPS_BRAND.logoPath}
      alt={GARMOPS_BRAND.name}
      width={GARMOPS_BRAND.logoWidth}
      height={GARMOPS_BRAND.logoHeight}
      className={`object-contain ${inverted ? "brightness-0 invert" : ""} ${className}`}
      preload={preload}
    />
  );
}
