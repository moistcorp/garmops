import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listCustomerOrders: vi.fn(),
  requireCustomer: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({
  requireCustomer: mocks.requireCustomer,
}));

vi.mock("@/lib/orders/dal", () => ({
  CUSTOMER_ORDER_PAGE_SIZE: 20,
  listCustomerOrders: mocks.listCustomerOrders,
}));

import AccountOrdersPage from "./page";

describe("AccountOrdersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCustomer.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
    });
    mocks.listCustomerOrders.mockResolvedValue({ data: [], error: null, count: 0 });
  });

  it("loads the exact customer account order history", async () => {
    const page = await AccountOrdersPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(page);

    expect(mocks.requireCustomer).toHaveBeenCalledWith("/account/orders");
    expect(mocks.listCustomerOrders).toHaveBeenCalledWith(
      {},
      "user-1",
      "all",
      1,
    );
    expect(html).toContain("My orders");
    expect(html).toContain("Your first verified full-payment order will appear here.");
  });

  it("loads a requested order-history page", async () => {
    await AccountOrdersPage({
      searchParams: Promise.resolve({ filter: "completed", page: "3" }),
    });

    expect(mocks.listCustomerOrders).toHaveBeenCalledWith(
      {},
      "user-1",
      "completed",
      3,
    );
  });

  it("shows a pending PayU recovery control for sample checkout returns", async () => {
    const page = await AccountOrdersPage({
      searchParams: Promise.resolve({
        payment: "pending",
        checkoutAttempt: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      }),
    });
    const html = renderToStaticMarkup(page);

    expect(html).toContain("Payment verification pending");
    expect(html).toContain("Check payment status");
  });

});
