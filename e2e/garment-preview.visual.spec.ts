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
  await expect(preview).toHaveAttribute("data-render-colour", colourHex);
  await expect(preview).toHaveAttribute("data-render-state", "ready");
  return preview;
}

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
