import type { Artwork, NeckLabel } from "@/lib/configurator/types/configurator";

export function isObjectUrl(url?: string): url is string {
  return typeof url === "string" && url.startsWith("blob:");
}

export function revokeObjectUrl(url?: string): void {
  if (isObjectUrl(url)) {
    URL.revokeObjectURL(url);
  }
}

export function revokeArtworkObjectUrls(artwork?: Artwork): void {
  revokeObjectUrl(artwork?.front?.fileUrl);
  revokeObjectUrl(artwork?.back?.fileUrl);
}

export function revokeNeckLabelObjectUrl(neckLabel?: Partial<NeckLabel>): void {
  revokeObjectUrl(neckLabel?.fileUrl);
}
