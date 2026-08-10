import { expect, test, type Page } from "@playwright/test";

async function configureWithoutArtwork(page: Page, productId: string, draftId: string, cartId?: string) {
  const query = new URLSearchParams({ draftId });
  if (cartId) query.set("cartId", cartId);
  await page.goto(`/configurator/build/${productId}?${query}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Continue to artwork/ }).click();
  await page.getByRole("button", { name: /Continue without artwork/ }).click();
  await page.getByRole("button", { name: /Continue to sizes/ }).click();
  await page.waitForURL(/\/configurator\/cart\/[^/]+\/review/);
  await expect(page.getByText("Allocate by size").first()).toBeVisible();
}

test("custom configuration reaches Delivery with canonical free shipping", async ({ page }) => {
  const cartId = "61111111-1111-4111-8111-111111111111";
  await configureWithoutArtwork(page, "regular-fit-tee-200gsm", cartId);
  await page.locator("input[id$=-m]").fill("50");
  await expect(page.getByText("Shipping", { exact: true })).toBeVisible();
  await expect(page.getByText("Free", { exact: true })).toBeVisible();
  await expect(page.getByText(/₹99|not yet priced|shipping payment/i)).toHaveCount(0);
  await page.getByRole("button", { name: /Continue to delivery/ }).click();
  await page.waitForURL(/\/shipping/);
  await expect(page.getByText(/Loading delivery details|Sign in to continue|Delivery details/i).first()).toBeVisible();
});

test("multi-product cart keeps independent MOQ allocations", async ({ page }) => {
  const cartId = "62222222-2222-4222-8222-222222222222";
  await configureWithoutArtwork(page, "regular-fit-tee-200gsm", cartId);
  await configureWithoutArtwork(page, "regular-fit-hoodie-320gsm", "63333333-3333-4333-8333-333333333333", cartId);
  await expect(page.getByText("LINE 1")).toBeVisible();
  await expect(page.getByText("LINE 2")).toBeVisible();
  const mediumInputs = page.locator("input[id$=-m]");
  await expect(mediumInputs).toHaveCount(2);
  await mediumInputs.nth(0).fill("50");
  await expect(page.getByText(/Enter a quantity for Classic Hoodie/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Continue to delivery/ })).toHaveAttribute("aria-disabled", "true");
  await mediumInputs.nth(1).fill("50");
  await expect(page.getByRole("button", { name: /Continue to delivery/ })).toHaveAttribute("aria-disabled", "false");
});

test("same product can be configured twice and each line enforces MOQ", async ({ page }) => {
  const cartId = "64444444-4444-4444-8444-444444444444";
  await configureWithoutArtwork(page, "regular-fit-tee-200gsm", cartId);
  await page.locator("input[id$=-m]").fill("50");
  await configureWithoutArtwork(page, "regular-fit-tee-200gsm", "65555555-5555-4555-8555-555555555555", cartId);
  await expect(page.getByText("Classic T-Shirt", { exact: true })).toHaveCount(2);
  await expect(page.getByText(/Enter a quantity for Classic T-Shirt/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Continue to delivery/ })).toHaveAttribute("aria-disabled", "true");
});

test("local draft survives a reload before authentication", async ({ page }) => {
  await page.goto("/configurator/build/regular-fit-tee-200gsm?draftId=66666666-6666-4666-8666-666666666666", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: /^Select / })).toHaveCount(8);
  for (const colour of ["Jet Black", "Classic White", "Navy Blue", "Charcoal Grey", "Heather Grey", "Bottle Green", "Burgundy", "Sand"]) {
    await expect(page.getByRole("button", { name: `Select ${colour}` })).toBeVisible();
  }
  await page.getByRole("button", { name: "Select Jet Black" }).click();
  await expect(page.getByRole("button", { name: "Select Jet Black" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /Continue to artwork/ }).click();
  await expect(page.getByRole("button", { name: /Continue without artwork/ })).toBeVisible();
  await page.waitForTimeout(1_000);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Select Jet Black" })).toHaveAttribute("aria-pressed", "true");
});

test("configurator exposes only supported techniques", async ({ page }) => {
  await page.goto("/configurator/build/regular-fit-tee-200gsm?draftId=e2e-supported-techniques", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("main").getByLabel(/front garment preview/i)).toBeVisible();
  await expect(page.getByText(/DTG|Embroidery|Puff Print|Sublimation/i)).toHaveCount(0);
});

test("payment result routes fail safely without a signed result", async ({ page }) => {
  await page.goto("/payment/success", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/payment|order/i).first()).toBeVisible();
});

test("public health endpoint is minimal and correlated", async ({ request }) => {
  const response = await request.get("/api/health", { headers: { "x-request-id": "E2EHEALTH1234" } });
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["x-request-id"]).toBe("E2EHEALTH1234");
  const body = await response.json();
  expect(body).toMatchObject({ status: "ok" });
  expect(JSON.stringify(body)).not.toMatch(/database|secret|queue|payu/i);
});
