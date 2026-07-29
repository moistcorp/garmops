"use client";

import type { CartDraft } from "@/components/configurator/cart/cartDraft";
import type { CartItem } from "@/components/configurator/cart/OrderReviewStep";
import type { BuildDraft } from "@/lib/configurator/buildDraft";
import {
  readCloudDesignLink,
  saveBuildDraftToCloud,
  writeCloudDesignLink,
  type CloudDesignLink,
} from "@/lib/designs/client";

const PREPARED_ORDER_PREFIX = "garmops:durable-order:";
export const CUSTOM_ORDER_TERMS_VERSION = "reservation-v1-2026-07-29";

type PreparedOrder = {
  fingerprint: string;
  idempotencyKey: string;
  designProjectId: string;
  designVersion: number;
};

type SubmissionResult =
  | {
      ok: true;
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
    ) {
      return null;
    }
    return value as PreparedOrder;
  } catch {
    return null;
  }
}

function writePreparedOrder(cartId: string, value: PreparedOrder): void {
  try {
    window.localStorage.setItem(
      preparedOrderKey(cartId),
      JSON.stringify(value),
    );
  } catch {
    // The server idempotency key still protects the active request. A browser
    // without storage simply cannot resume a lost response from this cart.
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
      {
        id: "garment-colour",
        title: "Garment colour",
        summary: item.colour.name,
        confirmed: true,
      },
      {
        id: "artwork",
        title: "Artwork",
        summary: hasArtwork ? "Artwork added" : null,
        confirmed: hasArtwork,
        skipped: !hasArtwork,
      },
      {
        id: "neck-label",
        title: "Neck label",
        summary: hasNeckLabel ? "Neck label added" : null,
        confirmed: hasNeckLabel,
        skipped: !hasNeckLabel,
      },
    ],
    quantity: Object.values(item.sizeQuantities).reduce(
      (total, value) => total + value,
      0,
    ),
  };
}

function fingerprintFor(draft: CartDraft): string {
  const artworkFingerprint = (item: CartItem) =>
    Object.fromEntries(
      (["front", "back"] as const)
        .filter((side) => Boolean(item.artwork[side]))
        .map((side) => {
          const artwork = item.artwork[side]!;
          return [
            side,
            {
              ...artwork,
              fileUrl:
                artwork.fileUrl.startsWith("/") ||
                artwork.fileUrl.startsWith("https://")
                  ? artwork.fileUrl
                  : undefined,
            },
          ];
        }),
    );
  return JSON.stringify({
    items: draft.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      colour: item.colour,
      artwork: artworkFingerprint(item),
      neckLabel: item.neckLabel,
      sizeQuantities: item.sizeQuantities,
    })),
    projectName: draft.projectName,
    companyInformation: draft.companyInformation,
    projectContact: draft.projectContact,
    shippingInformation: draft.shippingInformation,
    billingInformation: {
      ...draft.billingInformation,
      purchaseOrder: draft.billingInformation.purchaseOrder
        ? {
            fileName: draft.billingInformation.purchaseOrder.fileName,
            fileSize: draft.billingInformation.purchaseOrder.fileSize,
          }
        : undefined,
    },
    projectPreferences: draft.projectPreferences,
    selectedDeliveryDateIso: draft.selectedDeliveryDateIso,
    deliveryType: draft.deliveryType,
  });
}

async function freezeVersion(
  configId: string,
  link: CloudDesignLink,
): Promise<CloudDesignLink> {
  const response = await fetch(
    `/api/designs/${encodeURIComponent(link.designId)}/versions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedRevision: link.draftRevision }),
    },
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(body.error ?? "Design version could not be frozen");
  }
  const body = (await response.json()) as {
    version: {
      number: number;
      draftRevision: number;
      createdAt: string;
    };
  };
  const next = {
    ...link,
    currentVersion: body.version.number,
    draftRevision: body.version.draftRevision,
    lastSavedAt: body.version.createdAt,
    needsImportVersion: false,
  };
  writeCloudDesignLink(configId, next);
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

export async function prepareAndSubmitDurableOrder(input: {
  cartId: string;
  organizationId: string;
  draft: CartDraft;
}): Promise<SubmissionResult> {
  if (input.draft.items.length !== 1) {
    return {
      ok: false,
      kind: "validation",
      message:
        "Durable checkout currently accepts one configured product per order. Move additional products to a separate cart.",
    };
  }
  if (
    !input.draft.selectedDeliveryDateIso ||
    !input.draft.deliveryType
  ) {
    return {
      ok: false,
      kind: "validation",
      message: "Choose a delivery option and requested date before submission.",
    };
  }

  const item = input.draft.items[0];
  const fingerprint = fingerprintFor(input.draft);
  let prepared = readPreparedOrder(input.cartId);

  if (!prepared || prepared.fingerprint !== fingerprint) {
    const cloudResult = await saveBuildDraftToCloud({
      configId: item.productId,
      productName: item.productName,
      draft: draftForItem(item),
      existingLink: readCloudDesignLink(item.productId),
      operationKey: `checkout:${input.cartId}`,
    });
    if (!cloudResult.ok) {
      const message =
        cloudResult.kind === "conflict"
          ? "This design has newer cloud changes. Resolve them in the Studio before ordering."
          : cloudResult.message;
      return {
        ok: false,
        kind:
          cloudResult.kind === "unauthorized"
            ? "unauthorized"
            : cloudResult.kind === "unavailable"
              ? "unavailable"
              : "conflict",
        message,
      };
    }

    let frozen: CloudDesignLink;
    try {
      frozen = await freezeVersion(item.productId, cloudResult.link);
    } catch (error) {
      return {
        ok: false,
        kind: "conflict",
        message:
          error instanceof Error
            ? error.message
            : "Design version could not be frozen",
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

  const company = input.draft.companyInformation;
  const contact = input.draft.projectContact;
  const billing = input.draft.billingInformation;
  const billingAddress = billing.sameAsCompanyAddress
    ? company.address
    : billing.address;
  const response = await fetch("/api/orders/custom/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      designProjectId: prepared.designProjectId,
      designVersion: prepared.designVersion,
      organizationId: input.organizationId,
      sizeQuantities: item.sizeQuantities,
      deliveryType: input.draft.deliveryType,
      requestedDeliveryDate: localDateInIndia(
        input.draft.selectedDeliveryDateIso,
      ),
      projectName:
        input.draft.projectName.trim() || `${item.productName} project`,
      company: {
        name: company.name,
        gstin: company.gstin,
        industry: company.industry,
        website: company.website,
        poNumber: company.poNumber,
        costCentre: company.costCentre,
      },
      contact,
      shipping: input.draft.shippingInformation,
      billing: {
        entity: billing.entity || company.name,
        address: billingAddress,
        accountsPayableEmail:
          billing.accountsPayableEmail || contact.email,
        gstin: billing.gstin,
      },
      orderNotes: input.draft.projectPreferences.orderNotes,
      receiveEmails: input.draft.projectPreferences.receiveEmails,
      acceptedTerms: true,
      acceptedTermsVersion: CUSTOM_ORDER_TERMS_VERSION,
      idempotencyKey: prepared.idempotencyKey,
    }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    order?: SubmissionResult extends { ok: true; order: infer T } ? T : never;
  };
  if (!response.ok || !body.order) {
    return {
      ok: false,
      kind:
        response.status === 401
          ? "unauthorized"
          : response.status === 503
            ? "unavailable"
            : response.status === 409
              ? "conflict"
              : "validation",
      message: body.error ?? "Order could not be submitted",
    };
  }

  return { ok: true, order: body.order };
}
