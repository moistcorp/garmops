const DEFAULT_ASSET_ORIGIN = "https://assets.garmops.com";

export const PUBLIC_ASSET_VERSION = "v1";

function normalizeAssetOrigin(value: string | undefined): string {
  const candidate = value?.trim();
  if (!candidate) return DEFAULT_ASSET_ORIGIN;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return DEFAULT_ASSET_ORIGIN;
    }
    return url.origin;
  } catch {
    return DEFAULT_ASSET_ORIGIN;
  }
}

export const publicAssetOrigin = normalizeAssetOrigin(
  process.env.NEXT_PUBLIC_ASSET_CDN_URL,
);

export function publicAssetUrl(path: string): string {
  return `${publicAssetOrigin}/${path.replace(/^\/+/, "")}`;
}

export function garmentAssetUrl(path: string): string {
  return publicAssetUrl(`garments/${PUBLIC_ASSET_VERSION}/${path}`);
}

export function flatlayAssetPath(filename: string): string {
  return publicAssetUrl(`flatlays/${PUBLIC_ASSET_VERSION}/${filename.replace(/^\/+/, "")}`);
}
