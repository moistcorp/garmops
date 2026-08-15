import { expect, test } from "./fixtures/authenticated";

test.describe("Stage 4.1 authenticated browser smoke", () => {
  test("@backend customer can sign in, load the account, and log out", async ({ page, loginCustomer, customerEmail }) => {
    await loginCustomer(page, customerEmail);
    await expect(page.getByRole("link", { name: "Orders" }).first()).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/login/);
    expect((await page.request.get("/api/medusa/store/customers/me")).status()).toBeGreaterThanOrEqual(400);
  });

  test("@backend customer session cannot enter Foundry", async ({ page, loginCustomer }) => {
    await loginCustomer(page);
    const response = await page.request.get("/api/medusa/foundry/session");
    expect([401, 403]).toContain(response.status());
  });

  test("@backend Founder reaches the Foundry dashboard and uses the staff logout path", async ({ page, loginStaff }) => {
    await loginStaff(page, "founder");
    await expect(page.getByText(/Production workflow/i)).toBeVisible();
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/login/);
  });

  test("@backend Operations reaches Foundry without Founder-only navigation", async ({ page, loginStaff }) => {
    await loginStaff(page, "operations");
    await expect(page.getByText(/Production workflow/i)).toBeVisible();
    await expect(page.getByRole("link", { name: "Staff" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Analytics" })).toHaveCount(0);
  });
});
