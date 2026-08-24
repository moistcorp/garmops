import type { GarmentView } from "@/lib/configurator/types/garment";

const CAPTURE_SCALE = 2;
const READY_TIMEOUT_MS = 5_000;

function nextFrame(): Promise<void> {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}

async function waitForGarmentRender(root: HTMLElement): Promise<boolean> {
  const startedAt = performance.now();
  while (performance.now() - startedAt < READY_TIMEOUT_MS) {
    const garmentCanvas = root.querySelector<HTMLCanvasElement>(
      'canvas[data-render-state="ready"][data-render-colour]',
    );
    if (garmentCanvas) {
      await nextFrame();
      await nextFrame();
      return true;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 80));
  }
  return false;
}

async function loadSvgImage(svg: SVGSVGElement): Promise<HTMLImageElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const serialized = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(
    new Blob([serialized], { type: "image/svg+xml;charset=utf-8" }),
  );
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Unable to render SVG preview layer"));
      image.src = url;
    });
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

async function drawLayer(
  context: CanvasRenderingContext2D,
  rootRect: DOMRect,
  element: HTMLCanvasElement | HTMLImageElement | SVGSVGElement,
): Promise<void> {
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  const destinationX = (rect.left - rootRect.left) * CAPTURE_SCALE;
  const destinationY = (rect.top - rootRect.top) * CAPTURE_SCALE;
  const destinationWidth = rect.width * CAPTURE_SCALE;
  const destinationHeight = rect.height * CAPTURE_SCALE;

  if (element instanceof HTMLImageElement) {
    if (!element.complete) await element.decode();
    context.drawImage(
      element,
      destinationX,
      destinationY,
      destinationWidth,
      destinationHeight,
    );
    return;
  }
  if (element instanceof SVGSVGElement) {
    const image = await loadSvgImage(element);
    context.drawImage(
      image,
      destinationX,
      destinationY,
      destinationWidth,
      destinationHeight,
    );
    return;
  }
  context.drawImage(
    element,
    destinationX,
    destinationY,
    destinationWidth,
    destinationHeight,
  );
}

export async function capturePdfPreview(view: GarmentView): Promise<string | undefined> {
  const wrapper = document.querySelector<HTMLElement>(
    `[data-configurator-pdf-preview-view="${view}"]`,
  );
  const root = wrapper?.querySelector<HTMLElement>(
    `[aria-label^="${view} garment preview"]`,
  );
  if (!root || !(await waitForGarmentRender(root))) return undefined;

  const rootRect = root.getBoundingClientRect();
  if (rootRect.width <= 0 || rootRect.height <= 0) return undefined;
  const output = document.createElement("canvas");
  output.width = Math.round(rootRect.width * CAPTURE_SCALE);
  output.height = Math.round(rootRect.height * CAPTURE_SCALE);
  const context = output.getContext("2d");
  if (!context) return undefined;
  context.fillStyle = "#F4F6F8";
  context.fillRect(0, 0, output.width, output.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  const layers = Array.from(
    root.querySelectorAll<HTMLCanvasElement | HTMLImageElement | SVGSVGElement>(
      "canvas, img, svg",
    ),
  );
  for (const layer of layers) {
    try {
      await drawLayer(context, rootRect, layer);
    } catch {
      // A single optional overlay must not prevent the garment snapshot from downloading.
    }
  }

  try {
    return output.toDataURL("image/jpeg", 0.9);
  } catch {
    return undefined;
  }
}
