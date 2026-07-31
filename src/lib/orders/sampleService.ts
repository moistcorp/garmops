import "server-only";

import type { User } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";

import { hashOrderRequest } from "./service";
import {
  SAMPLE_ORDER_PRICING_VERSION,
  SAMPLE_ORDER_SCHEMA_VERSION,
  priceSampleOrder,
} from "./samplePricing";
import type { SubmitSampleOrderRequest } from "./sampleSchema";
import { currentSampleTermsEvidence } from "./terms";

type SessionClient = Awaited<ReturnType<typeof createClient>>;

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

type AddressSnapshot = Readonly<{
  contactName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  countryCode: "IN";
}>;

function addressSnapshot(
  address: SubmitSampleOrderRequest["shipping"]["address"],
  contactName: string,
  phone: string,
): AddressSnapshot {
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

export async function submitSampleOrder(input: {
  supabase: SessionClient;
  user: User;
  request: SubmitSampleOrderRequest;
}) {
  const { request, user, supabase } = input;
  if (!user.email) throw new Error("Customer email is unavailable");

  const [
    membershipResult,
    profileResult,
    organizationResult,
    billingAddressResult,
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
      .from("profiles")
      .select("first_name, last_name, phone, department")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("organizations")
      .select(
        "id, legal_name, display_name, industry, website, gstin, pan, billing_email, phone, status",
      )
      .eq("id", request.organizationId)
      .maybeSingle(),
    supabase
      .from("addresses")
      .select("contact_name, phone, line1, line2, city, state, postal_code, country_code, gstin")
      .eq("organization_id", request.organizationId)
      .eq("is_default_billing", true)
      .maybeSingle(),
  ]);

  if (membershipResult.error || !membershipResult.data) {
    throw new Error("Active owner or buyer access is required");
  }
  if (profileResult.error || !profileResult.data) {
    throw new Error("Customer profile is incomplete");
  }
  if (
    organizationResult.error ||
    !organizationResult.data ||
    organizationResult.data.status !== "active"
  ) {
    throw new Error("Organization is unavailable");
  }

  const priced = priceSampleOrder(request.items);
  const organization = organizationResult.data;
  const contactName = `${request.contact.firstName} ${request.contact.lastName ?? ""}`.trim();
  const shippingAddress = addressSnapshot(
    request.shipping.address,
    request.shipping.recipientName,
    request.contact.phone,
  );
  const billingName = organization.legal_name || organization.display_name;
  const savedBilling =
    billingAddressResult.data?.country_code === "IN"
      ? billingAddressResult.data
      : null;
  const billingAddress: AddressSnapshot = savedBilling
    ? {
        contactName: savedBilling.contact_name ?? billingName,
        phone: savedBilling.phone ?? phoneE164(request.contact.phone),
        line1: savedBilling.line1,
        line2: savedBilling.line2,
        city: savedBilling.city,
        state: savedBilling.state,
        postalCode: savedBilling.postal_code,
        countryCode: "IN",
      }
    : {
        ...shippingAddress,
        contactName: billingName,
      };
  const billingSnapshot = {
    entity: billingName,
    accountsPayableEmail:
      organization.billing_email ?? request.contact.email,
    gstin: savedBilling?.gstin ?? organization.gstin,
    address: billingAddress,
    source: savedBilling
      ? "organization_default_billing_address"
      : "shipping_address_at_sample_checkout",
  };
  const shippingSnapshot = {
    recipientName: request.shipping.recipientName,
    address: shippingAddress,
    multipleLocations: false,
    multipleLocationsNotes: null,
  };
  const customerSnapshot = {
    userId: user.id,
    accountEmail: user.email.toLowerCase(),
    email: request.contact.email,
    name: contactName,
    firstName: request.contact.firstName,
    lastName: request.contact.lastName ?? null,
    phone: phoneE164(request.contact.phone),
    department: profileResult.data.department,
  };
  const companySnapshot = {
    organizationId: organization.id,
    legalName: organization.legal_name,
    displayName: organization.display_name,
    industry: organization.industry,
    website: organization.website,
    gstin: organization.gstin,
    pan: organization.pan,
    billingEmail: organization.billing_email,
    phone: organization.phone,
  };
  const termsEvidence = currentSampleTermsEvidence();
  const termsSnapshot = {
    accepted: true,
    version: termsEvidence.version,
    documentHash: termsEvidence.documentHash,
    acceptedAtServer: new Date().toISOString(),
    checkoutKind: "catalogue_sample_purchase",
    orderNotes: request.orderNotes ?? null,
  };

  const requestHash = hashOrderRequest({
    organizationId: request.organizationId,
    items: request.items,
    contact: request.contact,
    shipping: request.shipping,
    orderNotes: request.orderNotes ?? null,
    termsVersion: termsEvidence.version,
    canonicalPrice: {
      subtotalPaise: priced.subtotalPaise,
      shippingPaise: priced.shippingPaise,
      taxEstimatePaise: priced.taxEstimatePaise,
      estimatedTotalPaise: priced.estimatedTotalPaise,
    },
  });

  const admin = createAdminClient();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString();
  const rpc = admin.rpc as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;
  const { data, error } = await rpc("submit_order", {
    p_idempotency_key: request.idempotencyKey,
    p_request_hash: requestHash,
    p_order_type: "sample_purchase",
    p_organization_id: request.organizationId,
    p_customer_user_id: user.id,
    p_subtotal_paise: priced.subtotalPaise,
    p_shipping_paise: priced.shippingPaise,
    p_tax_estimate_paise: priced.taxEstimatePaise,
    p_reservation_amount_paise: 0,
    p_pricing_version: SAMPLE_ORDER_PRICING_VERSION,
    p_configuration_schema_version: SAMPLE_ORDER_SCHEMA_VERSION,
    p_billing_snapshot: billingSnapshot,
    p_shipping_snapshot: shippingSnapshot,
    p_customer_snapshot: customerSnapshot,
    p_company_snapshot: companySnapshot,
    p_terms_snapshot: termsSnapshot,
    p_items: priced.items,
    p_customer_reference: "Catalogue sample order",
    p_po_number: null,
    p_requested_delivery_date: null,
    p_expires_at: expiresAt,
  });
  const result = data?.[0];
  if (error || !result) {
    throw new Error(error?.message ?? "Sample order could not be submitted");
  }

  return {
    orderId: String(result.order_id),
    orderNumber: String(result.order_number),
    paymentAttemptId: String(result.payment_attempt_id),
    submittedAt: String(result.submitted_at),
    subtotalPaise: priced.subtotalPaise,
    shippingPaise: priced.shippingPaise,
    estimatedTotalPaise: priced.estimatedTotalPaise,
  };
}
