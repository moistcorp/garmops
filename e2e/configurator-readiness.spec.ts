import { expect, test, type Route } from "@playwright/test";

const GARMENT_TEST_PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function fulfillGarmentAsset(route: Route) {
  await route.fulfill({
    status: 200,
    contentType: "image/png",
    body: GARMENT_TEST_PIXEL,
  });
}

test("product selection opens the workspace after every preview angle is ready", async ({ page }) => {
  const requestedGarmentViews = new Set<string>();
  page.on("request", (request) => {
    const view = new URL(request.url()).pathname.match(
      /\/garments\/v[^/]+\/[^/]+\/(front|back|neck)\//,
    )?.[1];
    if (view) requestedGarmentViews.add(view);
  });

  await page.route("**/api/medusa/store/garmops/catalog", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        products: [{ slug: "regular-fit-tee-200gsm" }],
        currencyCode: "INR",
        shippingPaise: 0,
      }),
    });
  });

  let releaseGarmentAssets: () => void = () => undefined;
  const garmentAssetsReleased = new Promise<void>((resolve) => {
    releaseGarmentAssets = resolve;
  });
  await page.route("**/garments/v*/**", async (route) => {
    await garmentAssetsReleased;
    await fulfillGarmentAsset(route);
  });

  await page.goto("/configurator", { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: "Customise" }).click();
  await page.waitForURL(/\/configurator\/build\/regular-fit-tee-200gsm/);

  const loader = page.locator('[data-garmops-loader="true"]');
  await expect(loader).toBeVisible();
  await expect(loader.getByRole("heading", { name: "Preparing Classic T-Shirt" })).toBeVisible();
  await expect(loader.getByText("200 GSM · 100% Cotton", { exact: true })).toBeVisible();
  await expect(loader.getByRole("progressbar")).toHaveAttribute(
    "aria-valuetext",
    /Preparing previews/,
  );
  await expect(loader.locator('li[aria-label="Workspace: Ready"]')).toBeVisible();
  await expect(page.locator('[data-configurator-ready="false"]')).toBeAttached();
  await expect(page.getByLabel("Active customisation controls")).toBeAttached();

  await expect.poll(() => [...requestedGarmentViews].sort()).toEqual([
    "back",
    "front",
    "neck",
  ]);

  releaseGarmentAssets();

  await expect(page.locator('[data-configurator-ready="true"]')).toBeAttached();
  await expect(loader).toHaveCount(0);
  await expect(page.getByText("Updating garment preview…")).toHaveCount(0);
  await expect(
    page.getByRole("main").getByLabel(/front garment preview/i),
  ).toBeVisible();

  await page.getByRole("tab", { name: "Neck" }).click();
  await expect(page.getByText("Updating garment preview…")).toHaveCount(0);
  await expect(
    page.getByRole("main").getByLabel(/neck garment preview/i),
  ).toBeVisible();

  await page.getByRole("tab", { name: "Back" }).click();
  await expect(page.getByText("Updating garment preview…")).toHaveCount(0);
  await expect(
    page.getByRole("main").getByLabel(/back garment preview/i),
  ).toBeVisible();
});

test("mobile opens preview-first and exposes the bottom controls", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/garments/v*/**", fulfillGarmentAsset);
  await page.goto("/configurator/build/regular-fit-tee-200gsm", { waitUntil: "domcontentloaded" });

  await expect(page.locator('[data-configurator-hydrated="true"]')).toBeAttached();
  await expect(page.getByText("Desktop required")).toHaveCount(0);
  await expect(page.locator('[data-configurator-preview="true"]')).toBeVisible();
  await expect(page.getByLabel("Order estimate")).toBeVisible();

  const controlsButton = page.getByRole("button", { name: /^Colour ·/ });
  await expect(controlsButton).toHaveAttribute("aria-expanded", "false");
  await controlsButton.click();
  await expect(controlsButton).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("heading", { name: "Choose your garment colour" })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Configurator progress" }).getByText("Colour", { exact: true }).last(),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Select Classic White" })).toBeVisible();

  const signatureTab = page.getByRole("tab", { name: /Signature/ });
  const customDyeTab = page.getByRole("tab", { name: /Custom dye/ });
  await signatureTab.focus();
  await signatureTab.press("ArrowRight");
  await expect(customDyeTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Search your colour")).toBeVisible();
});

test("artwork remains optional and added artwork exposes a gated production flow", async ({ page }) => {
  await page.route("**/garments/v*/**", fulfillGarmentAsset);
  await page.goto(
    "/configurator/build/regular-fit-tee-200gsm?draftId=e2e-artwork-flow&step=artwork",
    { waitUntil: "domcontentloaded" },
  );

  await expect(page.locator('[data-configurator-hydrated="true"]')).toBeAttached();
  await expect(page.getByRole("heading", { name: "Add your artwork" })).toBeVisible();
  await expect(page.getByText("Optional. Add artwork to either side, or continue without artwork.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue without artwork →" })).toBeEnabled();

  const frontTab = page.getByRole("tab", { name: /Front · Optional/ });
  const backTab = page.getByRole("tab", { name: /Back · Optional/ });
  await frontTab.focus();
  await frontTab.press("ArrowRight");
  await expect(backTab).toHaveAttribute("aria-selected", "true");
  await backTab.press("ArrowLeft");
  await expect(frontTab).toHaveAttribute("aria-selected", "true");

  await page.getByRole("button", { name: "Try sample artwork" }).click();
  const recommendedMethod = page.getByRole("radio", { name: /Screen Print/ });
  await expect(recommendedMethod).toHaveAttribute("aria-checked", "false");
  await expect(page.getByRole("button", { name: "Choose front print method to continue" })).toBeDisabled();
  await expect(page.getByText("+₹1,900 method total", { exact: true })).toBeVisible();

  await recommendedMethod.click();
  await expect(recommendedMethod).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("button", { name: "Continue to neck label →" })).toBeEnabled();
  await expect(page.getByText(/Front: Screen Print · Back: Not added/)).toBeVisible();
});

test("mobile artwork drawer exposes the complete optional upload entry point", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/garments/v*/**", fulfillGarmentAsset);
  await page.goto(
    "/configurator/build/regular-fit-tee-200gsm?draftId=e2e-artwork-mobile&step=artwork",
    { waitUntil: "domcontentloaded" },
  );

  await expect(page.locator('[data-configurator-hydrated="true"]')).toBeAttached();
  await page.getByRole("button", { name: /^Artwork ·/ }).click();
  await expect(page.getByRole("heading", { name: "Add your artwork" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Drag artwork here or browse/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Download artwork template/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try sample artwork" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue without artwork →" })).toBeEnabled();
});

test("opens with an honest fallback state and can retry failed preview assets", async ({ page }) => {
  let failNeckTexture = true;
  await page.route("**/garments/v*/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (failNeckTexture && pathname.includes("/neck/texture.")) {
      await route.fulfill({ status: 500, body: "Preview asset unavailable" });
      return;
    }
    await fulfillGarmentAsset(route);
  });

  await page.goto(
    "/configurator/build/regular-fit-tee-200gsm?draftId=preview-fallback-test",
    { waitUntil: "domcontentloaded" },
  );

  await expect(page.locator('[data-configurator-ready="true"]')).toBeAttached();
  await expect(page.getByText("Some preview detail could not load")).toBeVisible();
  await expect(
    page.getByText("You can keep designing with the available preview or retry the missing views."),
  ).toBeVisible();

  const retryRequest = page.waitForRequest((request) =>
    new URL(request.url()).pathname.includes("/neck/texture."),
  );
  failNeckTexture = false;
  await page.getByRole("button", { name: "Retry previews" }).click();
  await retryRequest;
  await expect(page.locator('[data-configurator-ready="true"]')).toBeAttached();
  await expect(page.locator('[data-garmops-loader="true"]')).toHaveCount(0);
  await expect(page.getByText("Some preview detail could not load")).toHaveCount(0);
});

test("reduced motion keeps progress legible without moving loader decoration", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  let releaseGarmentAssets: () => void = () => undefined;
  const garmentAssetsReleased = new Promise<void>((resolve) => {
    releaseGarmentAssets = resolve;
  });
  await page.route("**/garments/v*/**", async (route) => {
    await garmentAssetsReleased;
    await fulfillGarmentAsset(route);
  });

  await page.goto(
    "/configurator/build/regular-fit-tee-200gsm?draftId=reduced-motion-loader-test",
    { waitUntil: "domcontentloaded" },
  );

  const loader = page.locator('[data-garmops-loader="true"]').filter({
    has: page.getByRole("heading", { name: "Preparing Classic T-Shirt" }),
  });
  await expect(loader).toBeVisible();
  await expect(loader.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "30");
  await expect(loader.locator(".garmops-loader-step-pulse").first()).toHaveCSS(
    "animation-name",
    "none",
  );

  releaseGarmentAssets();
});

test("the selected-product loader fits a short mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  let releaseGarmentAssets: () => void = () => undefined;
  const garmentAssetsReleased = new Promise<void>((resolve) => {
    releaseGarmentAssets = resolve;
  });
  await page.route("**/garments/v*/**", async (route) => {
    await garmentAssetsReleased;
    await fulfillGarmentAsset(route);
  });

  await page.goto(
    "/configurator/build/canvas-tote-bag?draftId=mobile-loader-test",
    { waitUntil: "domcontentloaded" },
  );

  const loader = page.locator('[data-garmops-loader="true"]').filter({
    has: page.getByRole("heading", { name: "Preparing Canvas Tote Bag" }),
  });
  await expect(loader).toBeVisible();
  await expect(loader.getByText("340 GSM · Natural Canvas", { exact: true })).toBeVisible();
  const card = await loader.locator(".garmops-loader-card").boundingBox();
  expect(card).not.toBeNull();
  expect(card!.y).toBeGreaterThanOrEqual(0);
  expect(card!.y + card!.height).toBeLessThanOrEqual(667);

  releaseGarmentAssets();
});
