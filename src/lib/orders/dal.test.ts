import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "@/types/database.generated";

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

function customerClient(paymentError: { message: string } | null = null) {
  const order = {
    id: "order-1",
    order_number: "GAR-2026-000001",
  };
  const results: Record<string, QueryResult> = {
    orders: { data: order, error: null },
    order_items: { data: [{ id: "item-1" }], error: null },
    invoices: { data: [{ id: "invoice-1" }], error: null },
  };

  return {
    from: (table: string) => query(results[table]),
    rpc: (name: string) => {
      if (name === "customer_order_history") {
        return Promise.resolve({ data: [{ id: "history-1" }], error: null });
      }
      if (name === "customer_payment_summaries") {
        return Promise.resolve({
          data: paymentError ? null : [{ payment_attempt_id: "payment-1" }],
          error: paymentError,
        });
      }
      return Promise.resolve({ data: null, error: { message: "unknown rpc" } });
    },
  } as unknown as SupabaseClient<Database>;
}

describe("getCustomerOrder", () => {
  it("loads the private customer order summary", async () => {
    const result = await getCustomerOrder(
      customerClient(),
      "user-1",
      "GAR-2026-000001",
    );

    expect(result.order.data).toMatchObject({
      id: "order-1",
      order_number: "GAR-2026-000001",
    });
    expect(result.items.data).toEqual([{ id: "item-1" }]);
    expect(result.history.data).toEqual([{ id: "history-1" }]);
    expect(result.payments.data).toEqual([
      { payment_attempt_id: "payment-1" },
    ]);
    expect(result.invoices.data).toEqual([{ id: "invoice-1" }]);
  });

  it("keeps the order available when payment history cannot be loaded", async () => {
    const result = await getCustomerOrder(
      customerClient({ message: "payment unavailable" }),
      "user-1",
      "GAR-2026-000001",
    );

    expect(result.order.data).toMatchObject({ id: "order-1" });
    expect(result.payments.error).toEqual({ message: "payment unavailable" });
  });
});
