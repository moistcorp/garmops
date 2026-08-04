"use client";

import type { CartDraft } from "@/components/configurator/cart/cartDraft";
import type { CartItem } from "@/components/configurator/cart/OrderReviewStep";
import type { BuildDraft } from "@/lib/configurator/buildDraft";
import {
  CUSTOM_ORDER_PRIVACY_VERSION,
  CUSTOM_ORDER_TERMS_VERSION,
} from "@/lib/orders/terms";
import { submitPayuCheckout } from "@/lib/payuClient";
import {
  readCloudDesignLink,
  saveBuildDraftToCloud,
  writeCloudDesignLink,
  type CloudDesignLink,
} from "@/lib/designs/client";

const PREPARED_ORDER_PREFIX = "garmops:durable-order:";

type PreparedOrder = {
  fingerprint: string;
  idempotencyKey: string;
  designProjectId: string;
  designVersion: number;
};

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

function preparedOrderKey(cartId: string): string {
  return `${PREPARED_ORDER_PREFIX}${cartId}`;
}

function readPreparedOrder(cartId: string): PreparedOrder | null {
  try {
    const raw = window.localStorage.getItem(preparedOrderKey(cartId));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<PreparedOrder>;
    if (
      typeof value.fingerprint !== "string" ||
      typeof value.idempotencyKey !== "string" ||
      typeof value.designProjectId !== "string" ||
      !Number.isInteger(value.designVersion)
    ) return null;
    return value as PreparedOrder;
  } catch {
    return null;
  }
}

function writePreparedOrder(cartId: string, value: PreparedOrder): void {
  try {
    window.localStorage.setItem(preparedOrderKey(cartId), JSON.stringify(value));
  } catch {
    // Server idempotency remains authoritative when browser storage is unavailable.
  }
}

function draftForItem(item: CartItem): BuildDraft {
  const hasArtwork = Boolean(item.artwork.front || item.artwork.back);
  const hasNeckLabel = Boolean(item.neckLabel?.fileUrl || item.neckLabel?.fileId);
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    colour: { ...item.colour, confirmed: true },
    artwork: item.artwork,
    neckLabel: item.neckLabel ?? ({} as BuildDraft["neckLabel"]),
    steps: [
      { id: "garment-colour", title: "Garment colour", summary: item.colour.name, confirmed: true },
      { id: "artwork", title: "Artwork", summary: hasArtwork ? "Artwork added" : null, confirmed: hasArtwork, skipped: !hasArtwork },
      { id: "neck-label", title: "Neck label", summary: hasNeckLabel ? "Neck label added" : null, confirmed: hasNeckLabel, skipped: !hasNeckLabel },
    ],
    quantity: Object.values(item.sizeQuantities).reduce<number>((total, value) => total + Number(value), 0),
  };
}

function fingerprintFor(draft: CartDraft): string {
  const item = draft.items[0];
  return JSON.stringify({
    item: item ? {
      id: item.id,
      productId: item.productId,
      colour: item.colour,
      artwork: item.artwork,
      neckLabel: item.neckLabel,
      sizeQuantities: item.sizeQuantities,
    } : null,
    projectName: draft.projectName,
    contact: draft.projectContact,
    shipping: draft.shippingInformation,
    billing: draft.billingInformation,
    preferences: draft.projectPreferences,
    selectedDeliveryDateIso: draft.selectedDeliveryDateIso,
    deliveryType: draft.deliveryType,
    promoCode: draft.promoCode.trim().toUpperCase(),
  });
}

async function freezeVersion(storageKey: string, link: CloudDesignLink): Promise<CloudDesignLink> {
  const response = await fetch(`/api/designs/${encodeURIComponent(link.designId)}/versions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expectedRevision: link.draftRevision }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Design version could not be frozen");
  }
  const body = (await response.json()) as {
    version: { number: number; draftRevision: number; createdAt: string };
  };
  const next = {
    ...link,
    currentVersion: body.version.number,
    draftRevision: body.version.draftRevision,
    lastSavedAt: body.version.createdAt,
    needsImportVersion: false,
  };
  writeCloudDesignLink(storageKey, next);
  return next;
}

function localDateInIndia(value: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export async function prepareCustomCheckoutPayment(input: {
  cartId: string;
  draft: CartDraft;
}): Promise<SubmissionResult> {
  if (input.draft.items.length !== 1) {
    return {
      ok: false,
      kind: "validation",
      message: "Each order can contain one configured product. Start a separate order for another product.",
    };
  }
  if (!input.draft.selectedDeliveryDateIso || !input.draft.deliveryType) {
    return { ok: false, kind: "validation", message: "Choose a requested delivery date before payment." };
  }

  const item = input.draft.items[0];
  const storageKey = `cart-item:${item.id}`;
  const fingerprint = fingerprintFor(input.draft);
  let prepared = readPreparedOrder(input.cartId);

  if (!prepared || prepared.fingerprint !== fingerprint) {
    const cloudResult = await saveBuildDraftToCloud({
      configId: item.productId,
      storageKey,
      productName: item.productName,
      draft: draftForItem(item),
      existingLink: readCloudDesignLink(storageKey),
      operationKey: `checkout:${input.cartId}:${item.id}`,
    });
    if (!cloudResult.ok) {
      return {
        ok: false,
        kind: cloudResult.kind === "unauthorized"
          ? "unauthorized"
          : cloudResult.kind === "unavailable"
            ? "unavailable"
            : "conflict",
        message: cloudResult.kind === "conflict"
          ? "This design has newer cloud changes. Resolve them in the Studio before ordering."
          : cloudResult.message,
      };
    }

    let frozen: CloudDesignLink;
    try {
      frozen = await freezeVersion(storageKey, cloudResult.link);
    } catch (error) {
      return {
        ok: false,
        kind: "conflict",
        message: error instanceof Error ? error.message : "Design version could not be frozen",
      };
    }
    prepared = {
      fingerprint,
      idempotencyKey: crypto.randomUUID(),
      designProjectId: frozen.designId,
      designVersion: frozen.currentVersion,
    };
    writePreparedOrder(input.cartId, prepared);
  }

  const contact = input.draft.projectContact;
  const billing = input.draft.billingInformation;
  const fullName = `${contact.firstName} ${contact.lastName}`.trim();
  const billingAddress = billing.sameAsCompanyAddress
    ? input.draft.shippingInformation.address
    : billing.address;
  const response = await fetch("/api/orders/custom/prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cartId: input.cartId,
      returnPath: `/configurator/cart/${encodeURIComponent(input.cartId)}/confirmation`,
      designProjectId: prepared.designProjectId,
      designVersion: prepared.designVersion,
      sizeQuantities: item.sizeQuantities,
      deliveryType: input.draft.deliveryType,
      requestedDeliveryDate: localDateInIndia(input.draft.selectedDeliveryDateIso),
      projectName: input.draft.projectName.trim() || `${item.productName} project`,
      contact,
      shipping: input.draft.shippingInformation,
      billing: {
        entity: billing.entity || fullName,
        address: billingAddress,
        accountsPayableEmail: billing.accountsPayableEmail || contact.email,
        gstin: billing.gstin || undefined,
      },
      orderNotes: input.draft.projectPreferences.orderNotes,
      receiveEmails: input.draft.projectPreferences.receiveEmails,
      discountCode: input.draft.promoCode.trim() || undefined,
      saveShippingToAccount: false,
      saveBillingToAccount: false,
      acceptedTerms: true,
      acceptedTermsVersion: CUSTOM_ORDER_TERMS_VERSION,
      acceptedPrivacyVersion: CUSTOM_ORDER_PRIVACY_VERSION,
      idempotencyKey: prepared.idempotencyKey,
    }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    checkout?: {
      checkoutPaymentAttemptId: string | null;
      alreadyFinalized: boolean;
      orderNumber?: string;
      orderId?: string;
      paymentAttemptId?: string;
    };
  };
  if (!response.ok || !body.checkout) {
    return {
      ok: false,
      kind: response.status === 401
        ? "unauthorized"
        : response.status === 503
          ? "unavailable"
          : response.status === 409
            ? "conflict"
            : "validation",
      message: body.error ?? "Checkout could not be prepared",
    };
  }
  if (body.checkout.alreadyFinalized && body.checkout.orderNumber) {
    return {
      ok: true,
      kind: "already_finalized",
      order: {
        id: body.checkout.orderId ?? "",
        orderNumber: body.checkout.orderNumber,
        submittedAt: new Date().toISOString(),
        paymentAttemptId: body.checkout.paymentAttemptId ?? "",
        confirmationUrl: `/account/orders/${encodeURIComponent(body.checkout.orderNumber)}`,
      },
    };
  }
  if (!body.checkout.checkoutPaymentAttemptId) {
    return { ok: false, kind: "unavailable", message: "Payment attempt could not be prepared" };
  }

  const paymentResponse = await fetch("/api/payments/payu/initiate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ checkoutPaymentAttemptId: body.checkout.checkoutPaymentAttemptId }),
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
  submitPayuCheckout(paymentBody.fields, paymentBody.checkoutUrl);
  return { ok: true, kind: "payment_redirected" };
}
