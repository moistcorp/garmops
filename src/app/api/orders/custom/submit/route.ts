import { orderJsonError } from "@/lib/orders/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Custom orders are intentionally not accepted before payment verification.
 * The configurator now stages checkout through /api/orders/custom/prepare and
 * creates the durable order only from the verified PayU callback/reconciliation
 * path.
 */
export async function POST() {
  return orderJsonError(
    "Direct order submission is disabled. Start payment from the configurator checkout.",
    410,
  );
}
