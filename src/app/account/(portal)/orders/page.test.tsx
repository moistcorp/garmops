import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  medusaRequest: vi.fn(),
  requireCustomer: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({ requireCustomer: mocks.requireCustomer }));
vi.mock("@/lib/medusa/client", () => ({ medusaRequest: mocks.medusaRequest }));

import AccountOrdersPage from "./page";

describe("AccountOrdersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCustomer.mockResolvedValue({ user: { id: "customer-1" } });
    mocks.medusaRequest.mockResolvedValue({ orders: [] });
  });

  it("loads the private order history from Medusa", async () => {
    const page = await AccountOrdersPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(page);

    expect(mocks.requireCustomer).toHaveBeenCalledWith("/account/orders");
    expect(mocks.medusaRequest).toHaveBeenCalledWith(
      "/store/garmops/orders",
      { actor: "customer" },
    );
    expect(html).toContain("My orders");
    expect(html).toContain("Your first verified full-payment order will appear here.");
  });
});
