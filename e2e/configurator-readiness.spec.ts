import { expect, test } from "@playwright/test";

test("product selection keeps the workspace loader open until the preview is rendered", async ({ page }) => {
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
  await page.route("**/garments/v1/**", async (route) => {
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
  const progress = loader.getByRole("progressbar", {
    name: "Workspace loading progress",
  });
  await expect(progress).toBeVisible();
  await expect
    .poll(async () => Number(await progress.getAttribute("aria-valuenow")))
    .toBeGreaterThan(8);
  await expect
    .poll(async () => Number(await progress.getAttribute("aria-valuenow")))
    .toBeLessThan(100);

  releaseGarmentAssets();

  await expect(page.locator('[data-configurator-ready="true"]')).toBeAttached();
  await expect(loader).toHaveCount(0);
  await expect(
    page.getByRole("main").getByLabel(/front garment preview/i),
  ).toBeVisible();
});
