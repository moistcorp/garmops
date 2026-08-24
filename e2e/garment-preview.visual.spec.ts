import { expect, test, type Locator, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
  });
});

function renderedGarment(page: Page, view: "front" | "back" | "neck") {
  return page.getByRole("main").getByLabel(new RegExp(`${view} garment preview`, "i")).locator("canvas");
}

async function waitForPhotographicGarment(
  page: Page,
  view: "front" | "back" | "neck",
  colourHex: string,
): Promise<Locator> {
  const preview = renderedGarment(page, view);
  await expect(preview).toBeVisible();
  // Photographic layers are served from the public garment CDN. Wait for the
  // completed composite before checking its colour so a slow cold-cache fetch
  // does not fail the visual assertion while the canvas is still loading.
  await expect(preview).toHaveAttribute("data-render-state", "ready", { timeout: 60_000 });
  await expect(preview).toHaveAttribute("data-render-colour", colourHex);
  return preview;
}

async function observeWatercolourTransition(preview: Locator): Promise<void> {
  await preview.evaluate((canvas) => {
    const element = canvas as HTMLCanvasElement;
    element.dataset.watercolourObserved = "false";
    const observer = new MutationObserver(() => {
      if (element.dataset.colourTransition !== "watercolour") return;
      element.dataset.watercolourObserved = "true";
      observer.disconnect();
    });
    observer.observe(element, {
      attributes: true,
      attributeFilter: ["data-colour-transition"],
    });
    window.setTimeout(() => observer.disconnect(), 2_000);
  });
}

test("colour selection blooms through the garment and respects reduced motion", async ({ page }) => {
  await page.goto(
    "/configurator/build/regular-fit-tee-200gsm?draftId=e2e-watercolour-transition",
    { waitUntil: "domcontentloaded" },
  );
  await expect(page.locator('[data-configurator-hydrated="true"]')).toBeAttached();
  const preview = await waitForPhotographicGarment(page, "front", "#F5F5F2");

  await observeWatercolourTransition(preview);
  await page.getByRole("button", { name: "Select Jet Black" }).click();
  await expect(preview).toHaveAttribute("data-watercolour-observed", "true");
  await waitForPhotographicGarment(page, "front", "#161616");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await observeWatercolourTransition(preview);
  await page.getByRole("button", { name: "Select Navy Blue" }).click();
  await waitForPhotographicGarment(page, "front", "#202C46");
  await page.waitForTimeout(350);
  await expect(preview).toHaveAttribute("data-watercolour-observed", "false");
});

for (const colour of [
  { name: "Jet Black", hex: "#161616" },
  { name: "Classic White", hex: "#F5F5F2" },
  { name: "Navy Blue", hex: "#202C46" },
]) {
  test(`regular tee renderer signals — ${colour.name}`, async ({ page }) => {
    await page.goto(`/configurator/build/regular-fit-tee-200gsm?draftId=e2e-visual-${colour.name.toLowerCase().replaceAll(" ", "-")}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-configurator-hydrated="true"]')).toBeAttached();
    await page.getByRole("button", { name: `Select ${colour.name}` }).click();
    const preview = await waitForPhotographicGarment(page, "front", colour.hex);
    await expect(preview).toHaveScreenshot(`regular-tee-front-${colour.name.toLowerCase().replaceAll(" ", "-")}.png`, { maxDiffPixelRatio: 0.001 });
    await page.getByRole("tab", { name: "Back" }).click();
    await expect(await waitForPhotographicGarment(page, "back", colour.hex)).toHaveScreenshot(`regular-tee-back-${colour.name.toLowerCase().replaceAll(" ", "-")}.png`, { maxDiffPixelRatio: 0.001 });
  });
}

test("regular tee neck framing", async ({ page }) => {
  await page.goto("/configurator/build/regular-fit-tee-200gsm?draftId=e2e-visual-neck", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-configurator-hydrated="true"]')).toBeAttached();
  await page.getByRole("tab", { name: "Neck" }).click();
  await expect(await waitForPhotographicGarment(page, "neck", "#F5F5F2")).toHaveScreenshot("regular-tee-neck.png", { maxDiffPixelRatio: 0.001 });
});

test("regular hoodie front framing", async ({ page }) => {
  await page.addInitScript(() => {
  });
  await page.goto("/configurator/build/regular-fit-hoodie-320gsm?draftId=e2e-visual-hoodie", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-configurator-hydrated="true"]')).toBeAttached();
  await page.getByRole("button", { name: "Select Classic White" }).click();
  const preview = await waitForPhotographicGarment(page, "front", "#F5F5F2");
  await expect(preview).toHaveScreenshot("regular-hoodie-front.png", { maxDiffPixelRatio: 0.001 });
});

test("tote bag label only offers the fixed custom placement", async ({ page }) => {
  await page.goto(
    "/configurator/build/canvas-tote-bag?step=neck-label&draftId=e2e-tote-label-options",
    { waitUntil: "domcontentloaded" },
  );
  await expect(page.locator('[data-configurator-hydrated="true"]')).toBeAttached();

  await expect(page.getByLabel("Custom bag label only")).toBeVisible();
  await expect(page.getByRole("button", { name: /Standard (bag|size) label/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Inside top seam/i })).toHaveCount(1);
  await expect(page.getByRole("button", { name: /Inside top seam/i })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /On inner seam/i })).toHaveCount(0);
  await expect(page.getByText(/Standard bag label/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Upload bag label to continue" })).toBeVisible();

  await page.getByRole("button", { name: "Upload bag label to continue" }).click();
  await expect(page.getByText("Upload your custom bag label artwork before continuing.", { exact: true })).toBeVisible();
});

const garmentFamilies = [
  { slug: "boxy-fit-tee", productId: "boxy-fit-tee-260gsm" },
  { slug: "longsleeve-tee", productId: "longsleeve-tee-260gsm" },
  { slug: "polo", productId: "polo-280gsm" },
  { slug: "regular-fit-sweatshirt", productId: "regular-fit-sweatshirt-320gsm" },
  { slug: "regular-fit-hoodie", productId: "regular-fit-hoodie-320gsm" },
  { slug: "boxy-fit-hoodie", productId: "boxy-fit-hoodie-320gsm" },
  { slug: "canvas-tote-bag", productId: "canvas-tote-bag" },
] as const;

for (const garment of garmentFamilies) {
  test(`${garment.slug} photographic views`, async ({ page }) => {
    await page.addInitScript(() => {
    });
    await page.goto(
      `/configurator/build/${garment.productId}?draftId=e2e-visual-${garment.slug}`,
      { waitUntil: "domcontentloaded" },
    );
    await expect(page.locator('[data-configurator-hydrated="true"]')).toBeAttached();
    if (garment.slug === "canvas-tote-bag") {
      await expect(page.getByText("04 Bag Label", { exact: true })).toBeVisible();
    }

    for (const colour of [
      { name: "Jet Black", hex: "#161616" },
      { name: "Classic White", hex: "#F5F5F2" },
    ] as const) {
      await page.getByRole("button", { name: `Select ${colour.name}` }).click();
      const colourSlug = colour.name.toLowerCase().replaceAll(" ", "-");

      for (const view of ["front", "back"] as const) {
        await page.getByRole("tab", { name: view === "front" ? "Front" : "Back" }).click();
        const preview = await waitForPhotographicGarment(page, view, colour.hex);
        await expect(preview).toHaveScreenshot(
          `${garment.slug}-${view}-${colourSlug}.png`,
          { maxDiffPixelRatio: 0.001 },
        );
      }
    }

    await page.getByRole("button", { name: "Select Jet Black" }).click();
    await page.getByRole("tab", {
      name: garment.slug === "canvas-tote-bag" ? "Label" : "Neck",
    }).click();
    const neckPreview = await waitForPhotographicGarment(page, "neck", "#161616");
    await expect(neckPreview).toHaveScreenshot(
      `${garment.slug}-${garment.slug === "canvas-tote-bag" ? "label" : "neck"}-jet-black.png`,
      { maxDiffPixelRatio: 0.001 },
    );
  });
}

test("remote garment pixels remain readable for all artwork material simulations", async ({ page }) => {
  const browserErrors: string[] = [];
  const failedAssetRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    if (request.url().startsWith("https://assets.garmops.com/")) {
      failedAssetRequests.push(`${request.url()}: ${request.failure()?.errorText ?? "failed"}`);
    }
  });

  await page.goto(
    "/configurator/build/regular-fit-tee-200gsm?draftId=e2e-r2-artwork-materials",
    { waitUntil: "domcontentloaded" },
  );
  await expect(page.locator('[data-configurator-hydrated="true"]')).toBeAttached();
  await page.getByRole("button", { name: "Continue with Classic White →" }).click();
  await page.getByRole("button", { name: "Try sample artwork" }).click();
  await expect(page.getByLabel("Artwork uploaded")).toBeVisible();

  for (const technique of [
    { label: "Screen Print", value: "screen_print" },
    { label: "DTF", value: "dtf" },
    { label: "Reflective Print", value: "reflective_print" },
  ] as const) {
    await page.getByRole("radio", { name: technique.label }).click();
    const materialCanvas = page
      .getByRole("main")
      .locator(`canvas[data-artwork-technique="${technique.value}"]`);
    await expect(materialCanvas).toHaveAttribute("data-render-state", "ready");
    await expect(materialCanvas).toBeVisible();
    await materialCanvas.evaluate((canvas) => {
      const context = (canvas as HTMLCanvasElement).getContext("2d");
      if (!context) throw new Error("Canvas 2D context unavailable");
      context.getImageData(0, 0, 1, 1);
    });
  }

  expect(failedAssetRequests).toEqual([]);
  expect(browserErrors.filter((message) => /cors|taint|securityerror/iu.test(message))).toEqual([]);
});
