import { expect, test } from "@playwright/test";

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
    await route.continue();
  });

  await page.goto("/configurator", { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: "Customise" }).click();
  await page.waitForURL(/\/configurator\/build\/regular-fit-tee-200gsm/);

  const loader = page.getByRole("status", {
    name: "Preparing your Garmops workspace",
  });
  await expect(loader).toBeVisible();
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
});
