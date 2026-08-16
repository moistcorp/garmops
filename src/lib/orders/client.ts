"use client";

import type { CartDraft } from "@/components/configurator/cart/cartDraft";
import type { CartItem } from "@/components/configurator/cart/OrderReviewStep";
import type { BuildDraft } from "@/lib/configurator/buildDraft";
import { isCustomNeckLabel, createStandardNeckLabel } from "@/lib/configurator/neckLabel";
import {
  CHECKOUT_PRIVACY_VERSION,
  CONFIGURATOR_ORDER_TERMS_VERSION,
} from "@/lib/orders/terms";
import { submitPayuCheckout } from "@/lib/payuClient";
import { prepareConfiguredCheckout } from "@/lib/medusa/commerce";

type SubmissionResult =
  | { ok: true; kind: "payment_redirected" }
  | { ok: true; kind: "payment_completed"; confirmationUrl: string }
  | {
      ok: true;
      kind: "already_finalized";
      order: {
        id: string;
        orderNumber: string;
        submittedAt: string;
        paymentAttemptId: string;
        confirmationUrl: string;
      };
    }
  | {
      ok: false;
      kind: "unauthorized" | "validation" | "conflict" | "unavailable";
      message: string;
    }
  | {
      ok: false;
      kind: "payment_pending";
      message: string;
      checkoutAttemptId: string;
    };

export type PaymentRecoveryOutcome = "success" | "failure" | "pending" | "needs_review";

export type PaymentRecoveryResult = {
  outcome: PaymentRecoveryOutcome;
  confirmationUrl?: string | null;
  error?: string;
};

export class PaymentAttemptRecoveryError extends Error {
  readonly outcome: Exclude<PaymentRecoveryOutcome, "failure">;
  readonly confirmationUrl: string | null;

  constructor(
    outcome: Exclude<PaymentRecoveryOutcome, "failure">,
    confirmationUrl?: string | null,
  ) {
    const message = outcome === "success"
      ? "This payment has already been completed."
      : outcome === "needs_review"
        ? "A previous payment needs review. Do not start another payment yet."
        : "A previous payment is still being verified. Check its status before trying again.";
    super(message);
    this.name = "PaymentAttemptRecoveryError";
    this.outcome = outcome;
    this.confirmationUrl = confirmationUrl ?? null;
  }
}

export function isActivePaymentAttemptError(error: unknown): boolean {
  const candidate = error as { message?: unknown; body?: Record<string, unknown> } | null;
  const text = [
    error instanceof Error ? error.message : undefined,
    typeof candidate?.message === "string" ? candidate.message : undefined,
    typeof candidate?.body?.message === "string" ? candidate.body.message : undefined,
    typeof candidate?.body?.code === "string" ? candidate.body.code : undefined,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();

  return (
    text.includes("payment attempt") && (text.includes("active") || text.includes("progress"))
  ) || text.includes("cart_locked_payment");
}

export async function recheckConfiguratorPayment(cartId: string): Promise<PaymentRecoveryResult> {
  return recheckPaymentAttempt({ cartId });
}

export async function recheckCheckoutPaymentAttempt(checkoutAttemptId: string): Promise<PaymentRecoveryResult> {
  return recheckPaymentAttempt({ checkoutAttemptId });
}

async function recheckPaymentAttempt(input: { cartId?: string; checkoutAttemptId?: string }): Promise<PaymentRecoveryResult> {
  const response = await fetch("/api/payments/payu/recheck", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = (await response.json().catch(() => ({}))) as Partial<PaymentRecoveryResult>;
  if (!response.ok && body.outcome !== "pending") {
    throw new Error(body.error ?? "Payment status could not be checked");
  }
  return {
    outcome: body.outcome === "success" || body.outcome === "failure" || body.outcome === "needs_review"
      ? body.outcome
      : "pending",
    confirmationUrl: body.confirmationUrl,
    error: body.error,
  };
}

/**
 * A failed PayU attempt is the only safe state in which a locked cart may be
 * retried. Pending, review, and successful attempts stay blocked so a second
 * charge cannot be started accidentally.
 */
export async function retryAfterFailedPaymentAttempt<T>(
  cartId: string,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isActivePaymentAttemptError(error)) throw error;

    let recovery: PaymentRecoveryResult;
    try {
      recovery = await recheckConfiguratorPayment(cartId);
    } catch {
      throw new PaymentAttemptRecoveryError("pending");
    }
    if (recovery.outcome === "failure") return operation();
    throw new PaymentAttemptRecoveryError(recovery.outcome, recovery.confirmationUrl);
  }
}

const CHECKOUT_REQUEST_TIMEOUT_MS = 30_000;

async function withCheckoutTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  message: string,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), CHECKOUT_REQUEST_TIMEOUT_MS);
  try {
    return await operation(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) throw new Error(message);
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function buildCheckoutDraftForItem(item: CartItem): BuildDraft {
  const hasArtwork = Boolean(item.artwork.front || item.artwork.back);
  const currentNeckLabel = item.neckLabel ?? createStandardNeckLabel();
  const hasNeckLabel = isCustomNeckLabel(currentNeckLabel);
  const neckLabel = hasNeckLabel
    ? currentNeckLabel
    : { ...currentNeckLabel, confirmed: true };
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    colour: { ...item.colour, confirmed: true },
    artwork: item.artwork,
    neckLabel,
    steps: [
      { id: "garment-colour", title: "Garment colour", summary: item.colour.name, confirmed: true },
      { id: "artwork", title: "Artwork", summary: hasArtwork ? "Artwork added" : null, confirmed: hasArtwork, skipped: !hasArtwork },
      { id: "neck-label", title: "Neck label", summary: hasNeckLabel ? "Custom neck label" : "Standard size label", confirmed: true, skipped: false },
    ],
    quantity: Object.values(item.sizeQuantities).reduce<number>((total, value) => total + Number(value), 0),
  };
}

function localDateInIndia(value: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export async function prepareConfiguratorCheckoutPayment(input: {
  cartId: string;
  draft: CartDraft;
}): Promise<SubmissionResult> {
  if (input.draft.items.length === 0 || input.draft.items.length > 20) {
    return {
      ok: false,
      kind: "validation",
      message: input.draft.items.length === 0
        ? "Add at least one configured product before payment."
        : "A cart can contain at most 20 configured products.",
    };
  }
  if (!input.draft.selectedDeliveryDateIso || !input.draft.deliveryType) {
    return { ok: false, kind: "validation", message: "Choose a requested delivery date before payment." };
  }

  const contact = input.draft.projectContact;
  const billing = input.draft.billingInformation;
  const selectedDeliveryDateIso = input.draft.selectedDeliveryDateIso;
  const fullName = `${contact.firstName} ${contact.lastName}`.trim();
  const billingAddress = billing.sameAsCompanyAddress
    ? input.draft.shippingInformation.address
    : billing.address;
  if (input.draft.promoCode.trim()) return { ok: false, kind: "validation", message: "Promotional codes are not available for this checkout." };

  let preparedCartId: string | undefined;

  async function resolveExistingAttempt(fallbackMessage: string): Promise<SubmissionResult> {
    try {
      const recovery = await recheckConfiguratorPayment(preparedCartId ?? input.cartId);
      if (recovery.outcome === "success" && recovery.confirmationUrl) {
        return { ok: true, kind: "payment_completed", confirmationUrl: recovery.confirmationUrl };
      }
      if (recovery.outcome === "failure") {
        return { ok: false, kind: "unavailable", message: fallbackMessage };
      }
      return {
        ok: false,
        kind: "payment_pending",
        message: recovery.outcome === "needs_review"
          ? "The previous payment needs review. Do not start another payment yet."
          : "The previous payment is still being verified. Check its status before trying again.",
        checkoutAttemptId: preparedCartId ?? input.cartId,
      };
    } catch {
      return {
        ok: false,
        kind: "payment_pending",
        message: "The previous payment could not be verified yet. Do not start another payment until its status is confirmed.",
        checkoutAttemptId: preparedCartId ?? input.cartId,
      };
    }
  }

  async function attemptCheckout(canRecoverLockedCart: boolean): Promise<SubmissionResult> {
    preparedCartId = undefined;
    try {
      const prepared = await withCheckoutTimeout(
      (signal) => prepareConfiguredCheckout({
      cartId: input.cartId,
      email: contact.email,
      projectName: input.draft.projectName.trim() || "Merch project",
      orderNotes: input.draft.projectPreferences.orderNotes,
      gstin: billing.gstin || undefined,
      billingEntity: billing.entity || fullName,
      shippingAddress: {
        first_name: contact.firstName || "Customer",
        last_name: contact.lastName,
        address_1: input.draft.shippingInformation.address.addressLine1,
        address_2: input.draft.shippingInformation.address.addressLine2,
        city: input.draft.shippingInformation.address.city,
        province: input.draft.shippingInformation.address.state,
        postal_code: input.draft.shippingInformation.address.zip,
        country_code: "in",
        phone: contact.phone,
      },
      billingAddress: {
        first_name: billing.entity || fullName || "Customer",
        address_1: billingAddress.addressLine1,
        address_2: billingAddress.addressLine2,
        city: billingAddress.city,
        province: billingAddress.state,
        postal_code: billingAddress.zip,
        country_code: "in",
        phone: contact.phone,
      },
      termsVersion: CONFIGURATOR_ORDER_TERMS_VERSION,
      privacyVersion: CHECKOUT_PRIVACY_VERSION,
      requestedDeliveryDate: localDateInIndia(selectedDeliveryDateIso),
      deliveryPreference: input.draft.deliveryType,
      signal,
      }),
      "Checkout preparation is taking too long. Please try again.",
      );
      preparedCartId = prepared.checkout.cartId;

      const paymentResponse = await withCheckoutTimeout(
      (signal) => fetch("/api/payments/payu/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cartId: prepared.checkout.cartId }),
        signal,
      }),
      "Secure payment could not be started in time. Please try again.",
      );
      const paymentBody = (await paymentResponse.json().catch(() => ({}))) as {
        error?: string;
        checkoutUrl?: string;
        fields?: Record<string, string>;
      };
      if (!paymentResponse.ok || !paymentBody.fields || !paymentBody.checkoutUrl) {
        const message = paymentBody.error ?? "Secure payment could not be started";
        if (isActivePaymentAttemptError(new Error(message))) throw new Error(message);
        return {
          ok: false,
          kind: paymentResponse.status === 401 ? "unauthorized" : paymentResponse.status === 409 ? "conflict" : "unavailable",
          message,
        };
      }
      try {
        await submitPayuCheckout(paymentBody.fields, paymentBody.checkoutUrl);
        return { ok: true, kind: "payment_redirected" };
      } catch {
        // The server may have accepted the attempt even if this browser did
        // not navigate to PayU. Reconcile before showing a retry action.
        return resolveExistingAttempt("PayU did not open. The payment attempt was closed; please try again.");
      }
    } catch (error) {
      if (preparedCartId) return resolveExistingAttempt(error instanceof Error ? error.message : "Payment status could not be confirmed");
      if (canRecoverLockedCart && isActivePaymentAttemptError(error)) {
        try {
          const recovery = await recheckConfiguratorPayment(input.cartId);
          if (recovery.outcome === "failure") return attemptCheckout(false);
          if (recovery.outcome !== "success") {
            return {
              ok: false,
              kind: "payment_pending",
              message: recovery.outcome === "needs_review"
                ? "The previous payment needs review. Do not start another payment yet."
                : "The previous payment is still being verified. Check its status before trying again.",
              checkoutAttemptId: input.cartId,
            };
          }
          if (recovery.confirmationUrl) return { ok: true, kind: "payment_completed", confirmationUrl: recovery.confirmationUrl };
        } catch {
          return {
            ok: false,
            kind: "payment_pending",
            message: "The previous payment could not be verified yet. Do not start another payment until its status is confirmed.",
            checkoutAttemptId: input.cartId,
          };
        }
      }
      const status = error instanceof Error && error.name === "MedusaApiError" ? "conflict" : "unavailable";
      return { ok: false, kind: status, message: error instanceof Error ? error.message : "Checkout could not be prepared" };
    }
  }

  return attemptCheckout(true);
}
