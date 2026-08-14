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
    };

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
  const fullName = `${contact.firstName} ${contact.lastName}`.trim();
  const billingAddress = billing.sameAsCompanyAddress
    ? input.draft.shippingInformation.address
    : billing.address;
  if (input.draft.promoCode.trim()) return { ok: false, kind: "validation", message: "Promotional codes are not available for this checkout." };

  try {
    const prepared = await prepareConfiguredCheckout({
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
      requestedDeliveryDate: localDateInIndia(input.draft.selectedDeliveryDateIso),
      deliveryPreference: input.draft.deliveryType,
    });

    const paymentResponse = await fetch("/api/payments/payu/initiate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cartId: prepared.checkout.cartId }),
  });
  const paymentBody = (await paymentResponse.json().catch(() => ({}))) as {
    error?: string;
    checkoutUrl?: string;
    fields?: Record<string, string>;
  };
    if (!paymentResponse.ok || !paymentBody.fields || !paymentBody.checkoutUrl) {
    return {
      ok: false,
      kind: paymentResponse.status === 401 ? "unauthorized" : paymentResponse.status === 409 ? "conflict" : "unavailable",
      message: paymentBody.error ?? "Secure payment could not be started",
    };
    }
    await submitPayuCheckout(paymentBody.fields, paymentBody.checkoutUrl);
    return { ok: true, kind: "payment_redirected" };
  } catch (error) {
    const status = error instanceof Error && error.name === "MedusaApiError" ? "conflict" : "unavailable";
    return { ok: false, kind: status, message: error instanceof Error ? error.message : "Checkout could not be prepared" };
  }
}
