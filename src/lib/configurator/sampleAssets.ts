import { garmentAssetUrl } from "@/lib/publicAssets";

export const CONFIGURATOR_SAMPLE_ASSET_FILENAMES = [
  "artwork-sample.svg",
  "neck-label-sample.svg",
] as const;

export type ConfiguratorSampleAssetFilename =
  (typeof CONFIGURATOR_SAMPLE_ASSET_FILENAMES)[number];

export function isConfiguratorSampleAssetFilename(
  filename: string,
): filename is ConfiguratorSampleAssetFilename {
  return CONFIGURATOR_SAMPLE_ASSET_FILENAMES.some(
    (candidate) => candidate === filename,
  );
}

export function configuratorSampleAssetUrl(
  filename: ConfiguratorSampleAssetFilename,
): string {
  return garmentAssetUrl(filename);
}

export function isConfiguratorSampleAssetUrl(value: string | undefined): boolean {
  return Boolean(
    value &&
      CONFIGURATOR_SAMPLE_ASSET_FILENAMES.some(
        (filename) => configuratorSampleAssetUrl(filename) === value,
      ),
  );
}

export function uploadReadableAssetUrl(sourceUrl: string): string {
  const filename = CONFIGURATOR_SAMPLE_ASSET_FILENAMES.find(
    (candidate) => configuratorSampleAssetUrl(candidate) === sourceUrl,
  );
  return filename
    ? `/api/configurator/sample-assets/${encodeURIComponent(filename)}`
    : sourceUrl;
}
