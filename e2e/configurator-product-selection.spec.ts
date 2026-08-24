import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/medusa/store/garmops/catalog", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        products: [
          { slug: "regular-fit-tee-200gsm" },
          { slug: "boxy-fit-tee-200gsm" },
          { slug: "regular-fit-tee-260gsm" },
          { slug: "boxy-fit-tee-260gsm" },
        ],
        currencyCode: "INR",
        shippingPaise: 0,
      }),
    });
  });
});

test("product selection exposes comparison facts before customisation", async ({ page }) => {
  await page.goto("/configurator", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Choose your product" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Compare garments" })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Product categories" }).getByRole("paragraph"),
  ).toHaveText("4 products");

  const classicCard = page.getByRole("article").filter({ hasText: "Classic T-Shirt" });
  await expect(classicCard.getByText("200 GSM")).toBeVisible();
  await expect(classicCard.getByText("100% Cotton")).toBeVisible();
  await expect(classicCard.getByText("50 units")).toBeVisible();
  await expect(classicCard.getByText("16–22 working days")).toBeVisible();
  await expect(classicCard.getByRole("link", { name: "Customise" })).toBeVisible();

  const detailsButton = classicCard.getByRole("button", { name: "Product details" });
  await detailsButton.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Classic T-Shirt" })).toBeVisible();
  await expect(dialog.getByText("Screen print for value at scale")).toBeVisible();
  await dialog.getByRole("button", { name: "Close product details" }).click();
  await expect(detailsButton).toBeFocused();
});

test("mobile keeps category and result context visible", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/configurator", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("Categories")).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Product categories" }).locator("span").filter({ hasText: "4 products" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "All" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Customise" }).first()).toBeVisible();
});
