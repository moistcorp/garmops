import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@/types/database.generated";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

import { getCustomerOrder } from "./dal";

type QueryResult = { data: unknown; error: { message: string } | null };

function query(result: QueryResult) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    is: () => builder,
    in: () => builder,
    maybeSingle: () => Promise.resolve(result),
    then: (
      resolve: (value: QueryResult) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

function customerClient() {
  const order = {
    id: "order-1",
    order_number: "GAR-2026-000001",
  };
  const results: Record<string, QueryResult> = {
    orders: { data: order, error: null },
    order_items: { data: [{ id: "item-1" }], error: null },
    order_status_history: { data: [{ id: "history-1" }], error: null },
    order_comments: { data: [], error: null },
    approvals: {
      data: null,
      error: { message: "column approvals.snapshot_sha256 does not exist" },
    },
    shipments: { data: [], error: null },
    order_files: { data: [], error: null },
  };

  return {
    from: (table: string) => query(results[table]),
    rpc: () =>
      Promise.resolve({
        data: null,
        error: {
          message:
            "Could not find public.customer_shipment_events in the schema cache",
        },
      }),
  } as unknown as SupabaseClient<Database>;
}

describe("getCustomerOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createAdminClient.mockReturnValue({
      from: () => query({ data: [{ id: "payment-1" }], error: null }),
    });
  });

  it("keeps core order history available when optional lifecycle schema is absent", async () => {
    const result = await getCustomerOrder(
      customerClient(),
      "organization-1",
      "user-1",
      "GAR-2026-000001",
    );

    expect(result.order.data).toMatchObject({
      id: "order-1",
      order_number: "GAR-2026-000001",
    });
    expect(result.items.data).toEqual([{ id: "item-1" }]);
    expect(result.history.data).toEqual([{ id: "history-1" }]);
    expect(result.payments).toEqual([{ id: "payment-1" }]);
    expect(result.approvals).toEqual([]);
    expect(result.shipmentEvents).toEqual([]);
  });

  it("keeps the order available when payment history cannot be loaded", async () => {
    mocks.createAdminClient.mockReturnValue({
      from: () => query({ data: null, error: { message: "payment unavailable" } }),
    });

    const result = await getCustomerOrder(
      customerClient(),
      "organization-1",
      "user-1",
      "GAR-2026-000001",
    );

    expect(result.order.data).toMatchObject({ id: "order-1" });
    expect(result.payments).toEqual([]);
  });
});
