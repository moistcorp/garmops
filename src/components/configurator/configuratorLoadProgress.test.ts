import { describe, expect, it } from "vitest";
import { getConfiguratorLoadState } from "./configuratorLoadProgress";

describe("configurator load progress", () => {
  it("does not report preview work before the restored configuration is known", () => {
    const state = getConfiguratorLoadState(false, {
      front: { state: "ready", loadedLayers: 4, totalLayers: 4 },
    });

    expect(state.progress).toBe(10);
    expect(state.allPreviewsSettled).toBe(false);
    expect(state.hasPreviewErrors).toBe(false);
    expect(state.statusText).toBe("Restoring your product setup…");
  });

  it("uses completed layer and render work for determinate progress", () => {
    const state = getConfiguratorLoadState(true, {
      front: { state: "ready", loadedLayers: 4, totalLayers: 4 },
      back: { state: "loading", loadedLayers: 2, totalLayers: 4 },
      neck: { state: "loading", loadedLayers: 1, totalLayers: 4 },
    });

    expect(state.progress).toBe(70);
    expect(state.statusText).toBe("Preparing previews · 7/12 assets");
    expect(state.allPreviewsSettled).toBe(false);
  });

  it("weights progress by the relative asset cost of each preview view", () => {
    const state = getConfiguratorLoadState(
      true,
      {
        front: { state: "ready", loadedLayers: 4, totalLayers: 4 },
        back: { state: "loading", loadedLayers: 2, totalLayers: 4 },
        neck: { state: "loading", loadedLayers: 1, totalLayers: 4 },
      },
      { front: 10, back: 20, neck: 30 },
    );

    expect(state.progress).toBe(62);
  });

  it("only reaches 100 once every preview has rendered or failed safely", () => {
    const state = getConfiguratorLoadState(true, {
      front: { state: "ready", loadedLayers: 4, totalLayers: 4 },
      back: { state: "ready", loadedLayers: 4, totalLayers: 4 },
      neck: { state: "error", loadedLayers: 4, totalLayers: 4 },
    });

    expect(state.progress).toBe(100);
    expect(state.allPreviewsSettled).toBe(true);
    expect(state.hasPreviewErrors).toBe(true);
    expect(state.statusText).toBe("Workspace ready with a limited preview");
    expect(state.stages.at(-1)?.state).toBe("error");
  });
});
