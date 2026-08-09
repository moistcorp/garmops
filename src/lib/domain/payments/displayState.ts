export type PaymentDisplayState =
  | "success"
  | "pending"
  | "failure"
  | "needs_review"
  | "refunded";

export function getPaymentDisplayState(input: {
  outcome: "success" | "failure" | "pending" | "needs_review";
  paymentStatus: string;
}): PaymentDisplayState {
  if (
    input.outcome === "needs_review" ||
    ["duplicate_success", "disputed", "verification_required"].includes(
      input.paymentStatus,
    )
  ) {
    return "needs_review";
  }
  if (input.paymentStatus === "paid") return "success";
  if (input.paymentStatus === "refunded") return "refunded";
  if (["failed", "cancelled"].includes(input.paymentStatus)) return "failure";
  return input.outcome === "success" ? "success" : input.outcome;
}

export function paymentStatusLabel(state: PaymentDisplayState): string {
  switch (state) {
    case "success":
      return "Paid";
    case "failure":
      return "Not completed";
    case "needs_review":
      return "Needs review";
    case "pending":
      return "Being verified";
    case "refunded":
      return "Refunded";
  }
}
