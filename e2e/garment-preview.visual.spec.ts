import { expect, test, type Locator, type Page } from "@playwright/test";

function renderedGarment(page: Page, view: "front" | "back" | "neck") {
  return page.getByRole("main").getByLabel(new RegExp(`${view} garment preview`, "i")).locator("canvas");
}

async function waitForPhotographicGarment(
  page: Page,
  view: "front" | "back" | "neck",
): Promise<Locator> {
  const preview = renderedGarment(page, view);
  await expect(preview).toBeVisible();
  // Legacy assets are 1670px on their long edge. A width above the former
  // 1400px cap proves that the native-resolution photographic render landed.
  await expect
    .poll(() => preview.evaluate((canvas) => (canvas as HTMLCanvasElement).width))
    .toBeGreaterThan(1400);
  return preview;
}

for (const colour of ["Jet Black", "Classic White", "Navy Blue"]) {
  test(`regular tee renderer signals — ${colour}`, async ({ page }) => {
    await page.goto(`/configurator/build/regular-fit-tee-200gsm?draftId=e2e-visual-${colour.toLowerCase().replaceAll(" ", "-")}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: `Select ${colour}` }).click();
    const preview = renderedGarment(page, "front");
    await expect(preview).toBeVisible();
    await page.waitForTimeout(500);
    await expect(preview).toHaveScreenshot(`regular-tee-front-${colour.toLowerCase().replaceAll(" ", "-")}.png`, { maxDiffPixelRatio: 0.001 });
    await page.getByRole("tab", { name: "Back" }).click();
    await expect(renderedGarment(page, "back")).toHaveScreenshot(`regular-tee-back-${colour.toLowerCase().replaceAll(" ", "-")}.png`, { maxDiffPixelRatio: 0.001 });
  });
}

test("regular tee neck framing", async ({ page }) => {
  await page.goto("/configurator/build/regular-fit-tee-200gsm?draftId=e2e-visual-neck", { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Neck" }).click();
  await expect(renderedGarment(page, "neck")).toHaveScreenshot("regular-tee-neck.png", { maxDiffPixelRatio: 0.001 });
});

test("regular hoodie front framing", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("garmops_analytics_consent", "rejected");
  });
  await page.goto("/configurator/build/regular-fit-hoodie-320gsm?draftId=e2e-visual-hoodie", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Select Classic White" }).click();
  const preview = await waitForPhotographicGarment(page, "front");
  await expect(preview).toHaveScreenshot("regular-hoodie-front.png", { maxDiffPixelRatio: 0.001 });
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
      window.localStorage.setItem("garmops_analytics_consent", "rejected");
    });
    await page.goto(
      `/configurator/build/${garment.productId}?draftId=e2e-visual-${garment.slug}`,
      { waitUntil: "domcontentloaded" },
    );

    for (const colour of ["Jet Black", "Classic White"] as const) {
      await page.getByRole("button", { name: `Select ${colour}` }).click();
      const colourSlug = colour.toLowerCase().replaceAll(" ", "-");

      for (const view of ["front", "back"] as const) {
        await page.getByRole("tab", { name: view === "front" ? "Front" : "Back" }).click();
        const preview = await waitForPhotographicGarment(page, view);
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
    const neckPreview = await waitForPhotographicGarment(page, "neck");
    await expect(neckPreview).toHaveScreenshot(
      `${garment.slug}-${garment.slug === "canvas-tote-bag" ? "label" : "neck"}-jet-black.png`,
      { maxDiffPixelRatio: 0.001 },
    );
  });
}
