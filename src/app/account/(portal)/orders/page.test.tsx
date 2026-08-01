import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listCustomerOrders: vi.fn(),
  requireOrganizationMember: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({
  requireOrganizationMember: mocks.requireOrganizationMember,
}));

vi.mock("@/lib/orders/dal", () => ({
  listCustomerOrders: mocks.listCustomerOrders,
}));

import AccountOrdersPage from "./page";

describe("AccountOrdersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("DURABLE_CUSTOM_CHECKOUT_ENABLED", "false");
    vi.stubEnv("DURABLE_SAMPLE_CHECKOUT_ENABLED", "false");
    mocks.requireOrganizationMember.mockResolvedValue({
      supabase: {},
      membership: { organization_id: "organization-1" },
      user: { id: "user-1" },
    });
    mocks.listCustomerOrders.mockResolvedValue({ data: [], error: null });
  });

  it("loads order history when both checkout flows are disabled", async () => {
    const page = await AccountOrdersPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(page);

    expect(mocks.requireOrganizationMember).toHaveBeenCalledWith(
      "/account/orders",
    );
    expect(mocks.listCustomerOrders).toHaveBeenCalledWith(
      {},
      "organization-1",
      "user-1",
      "all",
    );
    expect(html).toContain("My orders");
    expect(html).toContain("Orders placed with Garmops will appear here.");
    expect(html).not.toContain("Durable ordering is disabled");
  });
});
