import { expect, test, type Page } from "@playwright/test";

function renderedGarment(page: Page, view: "front" | "back" | "neck") {
  return page.getByRole("main").getByLabel(new RegExp(`${view} garment preview`, "i")).locator("canvas");
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
  await page.goto("/configurator/build/regular-fit-hoodie-320gsm?draftId=e2e-visual-hoodie", { waitUntil: "domcontentloaded" });
  await expect(renderedGarment(page, "front")).toHaveScreenshot("regular-hoodie-front.png", { maxDiffPixelRatio: 0.001 });
});
