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
  stages: readonly ConfiguratorLoadStage[];
}

const ROUTE_READY_POINTS = 10;
const HYDRATION_POINTS = 20;
const PREVIEW_POINTS = 70;
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
  const previewWorkTotal = layerTotal + CONFIGURATOR_PREVIEW_VIEWS.length;
  const previewWorkComplete = loadedLayers + settledPreviews;
  const progress = Math.min(
    100,
    ROUTE_READY_POINTS +
      (hydrationComplete ? HYDRATION_POINTS : 0) +
      Math.round((previewWorkComplete / previewWorkTotal) * PREVIEW_POINTS),
  );

  let statusText = "Restoring workspace details…";
  if (hydrationComplete && loadedLayers < layerTotal) {
    statusText = `Loading product previews ${loadedLayers}/${layerTotal} layers…`;
  } else if (hydrationComplete && !allPreviewsSettled) {
    statusText = `Rendering preview angles ${settledPreviews}/${CONFIGURATOR_PREVIEW_VIEWS.length}…`;
  } else if (hydrationComplete) {
    statusText = "Front, back and neck previews ready";
  }

  return {
    progress,
    statusText,
    allPreviewsSettled,
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
