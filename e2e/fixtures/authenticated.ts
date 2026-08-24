/* eslint-disable react-hooks/rules-of-hooks */
import { expect, test as base, type Page } from "@playwright/test";

type AuthFixtures = {
  customerEmail: string;
  loginCustomer: (page: Page, email?: string) => Promise<void>;
  loginStaff: (page: Page, role: "founder" | "operations") => Promise<void>;
};

const suffix = `${process.env.PLAYWRIGHT_WORKER_INDEX ?? "0"}-${process.pid}`;

function customerEmailForProject(projectName?: string): string {
  const configured = process.env.E2E_CUSTOMER_EMAIL ?? `e2e-customer-${suffix}@example.test`;
  if (process.env.PLAYWRIGHT_BROWSER_MATRIX !== "true" || !projectName) return configured;
  const [local, domain] = configured.split("@");
  return `${local}+${projectName}@${domain}`;
}

export const test = base.extend<AuthFixtures>({
  customerEmail: async ({}, use, testInfo) => {
    await use(customerEmailForProject(testInfo.project.name));
  },
  loginCustomer: async ({}, use, testInfo) => {
    await use(async (page, email = customerEmailForProject(testInfo.project.name)) => {
      await page.goto("/login?next=%2Faccount%2Forders", { waitUntil: "domcontentloaded" });
      await page.getByLabel("Email address").fill(email);
      await page.getByRole("button", { name: "Email me a code →" }).click();
      await expect(page.getByTestId("e2e-test-otp")).toBeAttached();
      const code = await page.getByTestId("e2e-test-otp").textContent();
      expect(code).toMatch(/^\d{6}$/);
      await page.getByLabel("One-time code").fill(code ?? "");
      await page.getByRole("button", { name: "Verify and continue →" }).click();
      await page.waitForURL((url) => url.pathname === "/account/orders");
      const session = await page.evaluate(async () => {
        const response = await fetch("/api/medusa/store/customers/me", { cache: "no-store" });
        return { ok: response.ok, status: response.status, body: await response.text() };
      });
      expect(session.ok, `customer session request failed: ${session.status} ${session.body}`).toBeTruthy();
      await expect(page.getByText(email)).toBeVisible();
    });
  },
  loginStaff: async ({}, use) => {
    await use(async (page, role) => {
      const email = process.env[`E2E_${role.toUpperCase()}_EMAIL`];
      const password = process.env[`E2E_${role.toUpperCase()}_PASSWORD`];
      if (!email || !password) throw new Error(`E2E_${role.toUpperCase()}_EMAIL and E2E_${role.toUpperCase()}_PASSWORD are required`);
      await page.goto("/login?next=%2Forders", { waitUntil: "domcontentloaded" });
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill(password);
      await page.getByRole("button", { name: "Sign in" }).click();
      await page.waitForURL((url) => url.pathname === "/orders" || url.pathname.startsWith("/orders/"));
      await expect(page.getByText(/Authenticated/)).toBeVisible();
    });
  },
});

export { expect };
