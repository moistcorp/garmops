import type { GarmentView } from "@/lib/configurator/types/garment";

export const CONFIGURATOR_PREVIEW_VIEWS: readonly GarmentView[] = [
  "front",
  "back",
  "neck",
];

export type PreviewLoadState = "loading" | "compositing" | "ready" | "error";

export interface PreviewLoadProgress {
  state: PreviewLoadState;
  loadedLayers: number;
  totalLayers: number;
}

export type PreviewLoadProgressByView = Partial<
  Record<GarmentView, PreviewLoadProgress>
>;

export type ConfiguratorLoadStageState =
  | "queued"
  | "loading"
  | "complete"
  | "error";

export interface ConfiguratorLoadStage {
  label: string;
  state: ConfiguratorLoadStageState;
}

export interface ConfiguratorLoadState {
  progress: number;
  statusText: string;
  allPreviewsSettled: boolean;
  hasPreviewErrors: boolean;
  stages: readonly ConfiguratorLoadStage[];
}

const ROUTE_READY_POINTS = 10;
const HYDRATION_POINTS = 20;
const ASSET_POINTS = 65;
const COMPOSITE_POINTS = 5;
const FALLBACK_LAYER_COUNT = 4;

function isSettled(progress?: PreviewLoadProgress): boolean {
  return progress?.state === "ready" || progress?.state === "error";
}

function stageState(progress?: PreviewLoadProgress): ConfiguratorLoadStageState {
  if (!progress) return "queued";
  if (progress.state === "ready") return "complete";
  if (progress.state === "error") return "error";
  return "loading";
}

export function getConfiguratorLoadState(
  hydrationComplete: boolean,
  previews: PreviewLoadProgressByView,
  viewAssetWeights: Partial<Record<GarmentView, number>> = {},
): ConfiguratorLoadState {
  const effectivePreviews = hydrationComplete ? previews : {};
  const allPreviewsSettled = CONFIGURATOR_PREVIEW_VIEWS.every((view) =>
    isSettled(effectivePreviews[view]),
  );
  const layerTotal = CONFIGURATOR_PREVIEW_VIEWS.reduce(
    (total, view) => total + (effectivePreviews[view]?.totalLayers || FALLBACK_LAYER_COUNT),
    0,
  );
  const loadedLayers = CONFIGURATOR_PREVIEW_VIEWS.reduce(
    (total, view) =>
      total + Math.min(
        effectivePreviews[view]?.loadedLayers ?? 0,
        effectivePreviews[view]?.totalLayers || FALLBACK_LAYER_COUNT,
      ),
    0,
  );
  const settledPreviews = CONFIGURATOR_PREVIEW_VIEWS.filter((view) =>
    isSettled(effectivePreviews[view]),
  ).length;
  const hasPreviewErrors = CONFIGURATOR_PREVIEW_VIEWS.some(
    (view) => effectivePreviews[view]?.state === "error",
  );
  const assetWorkTotal = CONFIGURATOR_PREVIEW_VIEWS.reduce(
    (total, view) => total + Math.max(1, viewAssetWeights[view] ?? 1),
    0,
  );
  const assetWorkComplete = CONFIGURATOR_PREVIEW_VIEWS.reduce((total, view) => {
    const preview = effectivePreviews[view];
    const viewWeight = Math.max(1, viewAssetWeights[view] ?? 1);
    if (isSettled(preview)) return total + viewWeight;
    const totalLayers = preview?.totalLayers || FALLBACK_LAYER_COUNT;
    const completedFraction = Math.min(
      1,
      (preview?.loadedLayers ?? 0) / totalLayers,
    );
    return total + viewWeight * completedFraction;
  }, 0);
  const progress = Math.min(
    100,
    ROUTE_READY_POINTS +
      (hydrationComplete ? HYDRATION_POINTS : 0) +
      Math.round((assetWorkComplete / assetWorkTotal) * ASSET_POINTS) +
      Math.round(
        (settledPreviews / CONFIGURATOR_PREVIEW_VIEWS.length) *
          COMPOSITE_POINTS,
      ),
  );

  let statusText = "Restoring your product setup…";
  if (hydrationComplete && allPreviewsSettled && hasPreviewErrors) {
    statusText = "Workspace ready with a limited preview";
  } else if (hydrationComplete && allPreviewsSettled) {
    statusText = "Front, back and neck views are ready";
  } else if (hydrationComplete && loadedLayers < layerTotal) {
    statusText = `Preparing previews · ${loadedLayers}/${layerTotal} assets`;
  } else if (hydrationComplete && !allPreviewsSettled) {
    statusText = `Finishing previews · ${settledPreviews} of ${CONFIGURATOR_PREVIEW_VIEWS.length} views`;
  }

  return {
    progress,
    statusText,
    allPreviewsSettled,
    hasPreviewErrors,
    stages: [
      {
        label: "Workspace",
        state: hydrationComplete ? "complete" : "loading",
      },
      ...CONFIGURATOR_PREVIEW_VIEWS.map((view) => ({
        label: view[0].toUpperCase() + view.slice(1),
        state: stageState(effectivePreviews[view]),
      })),
    ],
  };
}
