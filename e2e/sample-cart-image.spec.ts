import { expect, test } from "@playwright/test";

test("sample cart thumbnails preserve the portrait product image", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "garmops-sample-cart",
      JSON.stringify({
        state: {
          items: [
            {
              id: 1,
              productSlug: "regular-fit-tee-200gsm",
              name: "Classic T-Shirt",
              price: 535,
              size: "M",
              quantity: 1,
              image: "/products/regular-fit-tee-200gsm.webp",
            },
          ],
        },
        version: 0,
      }),
    );
  });

  await page.goto("/cart", { waitUntil: "domcontentloaded" });

  const image = page.getByAltText("Classic T-Shirt");
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((element) => getComputedStyle(element).objectFit))
    .toBe("contain");

  const frame = await image.locator("..").boundingBox();
  expect(frame).not.toBeNull();
  expect(frame!.width).toBeCloseTo(80, 0);
  expect(frame!.height).toBeCloseTo(120, 0);
});
