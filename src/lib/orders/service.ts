import "server-only";

import { createHash } from "node:crypto";

import type { User } from "@supabase/supabase-js";

import { getServerEnvironment } from "@/lib/config/env";
import { cloudDesignSnapshotSchema } from "@/lib/designs/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.generated";

import { CUSTOM_ORDER_PRICING_VERSION, priceCustomOrder } from "./pricing";
import type { SubmitCustomOrderRequest } from "./schema";

type SessionClient = Awaited<ReturnType<typeof createClient>>;

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function hashOrderRequest(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function phoneE164(value: string): string {
  const digits = value.replace(/\D/g, "");
  const national =
    digits.length === 12 && digits.startsWith("91")
      ? digits.slice(2)
      : digits.length === 11 && digits.startsWith("0")
        ? digits.slice(1)
        : digits;
  return `+91${national}`;
}

function addressSnapshot(
  address: SubmitCustomOrderRequest["billing"]["address"],
  contactName: string,
  phone: string,
): Json {
  return {
    contactName,
    phone: phoneE164(phone),
    line1: address.addressLine1,
    line2: address.addressLine2 ?? null,
    city: address.city,
    state: address.state,
    postalCode: address.zip,
    countryCode: "IN",
  };
}

export async function submitCustomOrder(input: {
  supabase: SessionClient;
  user: User;
  request: SubmitCustomOrderRequest;
}) {
  const { request, user, supabase } = input;
  const [
    membershipResult,
    projectResult,
    versionResult,
    profileResult,
    organizationResult,
  ] = await Promise.all([
    supabase
      .from("organization_members")
      .select("role, status")
      .eq("organization_id", request.organizationId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .in("role", ["owner", "buyer"])
      .maybeSingle(),
    supabase
      .from("design_projects")
      .select("id, organization_id, status, schema_version, title")
      .eq("id", request.designProjectId)
      .eq("organization_id", request.organizationId)
      .maybeSingle(),
    supabase
      .from("design_project_versions")
      .select("id, version_number, configuration_snapshot, created_at")
      .eq("design_project_id", request.designProjectId)
      .eq("version_number", request.designVersion)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("first_name, last_name, phone, job_title, department")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("organizations")
      .select(
        "id, legal_name, display_name, industry, website, gstin, pan, billing_email, phone, status",
      )
      .eq("id", request.organizationId)
      .maybeSingle(),
  ]);

  if (membershipResult.error || !membershipResult.data) {
    throw new Error("Active owner or buyer access is required");
  }
  if (
    projectResult.error ||
    !projectResult.data ||
    projectResult.data.status === "archived"
  ) {
    throw new Error("Design project is unavailable");
  }
  if (versionResult.error || !versionResult.data) {
    throw new Error("Immutable design version is unavailable");
  }
  if (profileResult.error || !profileResult.data || !user.email) {
    throw new Error("Customer profile is incomplete");
  }
  if (
    organizationResult.error ||
    !organizationResult.data ||
    organizationResult.data.status !== "active"
  ) {
    throw new Error("Organization is unavailable");
  }

  const snapshot = cloudDesignSnapshotSchema.parse(
    versionResult.data.configuration_snapshot,
  );
  const priced = priceCustomOrder({
    snapshot,
    sizeQuantities: request.sizeQuantities,
    deliveryType: request.deliveryType,
  });
  const fileIds = [
    ...priced.fileIds,
    ...(request.purchaseOrderFileId ? [request.purchaseOrderFileId] : []),
  ];
  const uniqueFileIds = [...new Set(fileIds)];

  if (uniqueFileIds.length) {
    const { data: files, error: filesError } = await supabase
      .from("order_files")
      .select(
        "id, design_project_id, uploaded_by, kind, visibility, upload_status, scan_status, deleted_at",
      )
      .in("id", uniqueFileIds);
    if (
      filesError ||
      !files ||
      files.length !== uniqueFileIds.length ||
      files.some(
        (file) =>
          file.design_project_id !== request.designProjectId ||
          file.uploaded_by !== user.id ||
          file.visibility !== "customer" ||
          file.upload_status !== "finalized" ||
          file.deleted_at !== null ||
          !["customer_artwork", "purchase_order"].includes(file.kind) ||
          !["manual_review", "clean", "not_required"].includes(
            file.scan_status,
          ),
      )
    ) {
      throw new Error("A submitted file is unavailable or not finalized");
    }
  }

  const billingSnapshot = {
    entity: request.billing.entity,
    accountsPayableEmail: request.billing.accountsPayableEmail,
    gstin: request.billing.gstin ?? null,
    address: addressSnapshot(
      request.billing.address,
      request.billing.entity,
      request.contact.phone,
    ),
  };
  const shippingSnapshot = {
    recipientName: request.shipping.recipientName,
    address: addressSnapshot(
      request.shipping.address,
      request.shipping.recipientName,
      request.contact.phone,
    ),
    multipleLocations: request.shipping.multipleLocations,
    multipleLocationsNotes:
      request.shipping.multipleLocationsNotes ?? null,
  };
  const customerSnapshot = {
    userId: user.id,
    accountEmail: user.email.toLowerCase(),
    email: request.contact.email,
    name: `${request.contact.firstName} ${request.contact.lastName}`,
    firstName: request.contact.firstName,
    lastName: request.contact.lastName,
    phone: phoneE164(request.contact.phone),
    department: request.contact.department ?? null,
  };
  const organization = organizationResult.data;
  const companySnapshot = {
    organizationId: organization.id,
    legalName: organization.legal_name,
    displayName: organization.display_name,
    gstin: organization.gstin,
    pan: organization.pan,
    billingEmail: organization.billing_email,
    phone: organization.phone,
    submittedName: request.company.name,
    submittedGstin: request.company.gstin ?? null,
    industry: request.company.industry ?? organization.industry,
    website: request.company.website ?? organization.website,
    costCentre: request.company.costCentre ?? null,
  };
  const termsSnapshot = {
    accepted: true,
    version: request.acceptedTermsVersion,
    acceptedAtServer: new Date().toISOString(),
    reservationCreditedToFinalInvoice:
      getServerEnvironment().RESERVATION_CREDITED_TO_FINAL_INVOICE,
    orderNotes: request.orderNotes ?? null,
    receiveEmails: request.receiveEmails,
    requestedDeliveryDate: request.requestedDeliveryDate,
    deliveryType: request.deliveryType,
    designVersionCreatedAt: versionResult.data.created_at,
  };

  const requestHash = hashOrderRequest({
    ...request,
    immutableDesignVersionId: versionResult.data.id,
    canonicalPrice: {
      subtotalPaise: priced.subtotalPaise,
      shippingPaise: priced.shippingPaise,
      taxEstimatePaise: priced.taxEstimatePaise,
    },
  });
  const admin = createAdminClient();
  const environment = getServerEnvironment();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString();
  const { data, error } = await admin.rpc("submit_custom_order", {
    p_idempotency_key: request.idempotencyKey,
    p_request_hash: requestHash,
    p_organization_id: request.organizationId,
    p_customer_user_id: user.id,
    p_subtotal_paise: priced.subtotalPaise,
    p_shipping_paise: priced.shippingPaise,
    p_tax_estimate_paise: priced.taxEstimatePaise,
    p_reservation_amount_paise: environment.RESERVATION_AMOUNT_PAISE,
    p_pricing_version: CUSTOM_ORDER_PRICING_VERSION,
    p_configuration_schema_version: snapshot.schemaVersion,
    p_billing_snapshot: billingSnapshot as Json,
    p_shipping_snapshot: shippingSnapshot as Json,
    p_customer_snapshot: customerSnapshot as Json,
    p_company_snapshot: companySnapshot as Json,
    p_terms_snapshot: termsSnapshot as Json,
    p_items: [priced.item] as Json,
    p_design_project_id: request.designProjectId,
    p_design_version_id: versionResult.data.id,
    p_file_ids: uniqueFileIds,
    p_customer_reference: request.projectName,
    p_po_number: request.company.poNumber ?? (null as unknown as string),
    p_requested_delivery_date: request.requestedDeliveryDate,
    p_expires_at: expiresAt,
  });
  const result = data?.[0];
  if (error || !result) {
    throw new Error(error?.message ?? "Order could not be submitted");
  }

  return {
    ...result,
    estimatedTotalPaise: priced.estimatedTotalPaise,
    reservationAmountPaise: environment.RESERVATION_AMOUNT_PAISE,
  };
}

export async function retryOrderPayment(input: {
  orderId: string;
  userId: string;
  idempotencyKey: string;
}) {
  const admin = createAdminClient();
  const requestHash = hashOrderRequest({
    orderId: input.orderId,
    userId: input.userId,
  });
  const { data, error } = await admin.rpc("retry_order_payment", {
    p_order_id: input.orderId,
    p_customer_user_id: input.userId,
    p_idempotency_key: input.idempotencyKey,
    p_request_hash: requestHash,
  });
  const result = data?.[0];
  if (error || !result) {
    throw new Error(error?.message ?? "Payment retry could not be prepared");
  }
  return result;
}

export const retryCustomOrderPayment = retryOrderPayment;
