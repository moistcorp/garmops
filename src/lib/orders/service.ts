import "server-only";

import { createHash, randomUUID } from "node:crypto";

import type { User } from "@supabase/supabase-js";

import { getServerEnvironment } from "@/lib/config/env";
import { cloudDesignSnapshotSchema } from "@/lib/designs/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.generated";

import { CUSTOM_ORDER_PRICING_VERSION, priceCustomOrder } from "./pricing";
import type { SubmitCustomOrderRequest } from "./schema";

type SessionClient = Awaited<ReturnType<typeof createClient>>;
type AdminClient = ReturnType<typeof createAdminClient>;

type SubmitCustomOrderRpcArgs = {
  p_idempotency_key: string;
  p_request_hash: string;
  p_organization_id: string;
  p_customer_user_id: string;
  p_subtotal_paise: number;
  p_shipping_paise: number;
  p_tax_estimate_paise: number;
  p_reservation_amount_paise: number;
  p_pricing_version: string;
  p_configuration_schema_version: number;
  p_billing_snapshot: Json;
  p_shipping_snapshot: Json;
  p_customer_snapshot: Json;
  p_company_snapshot: Json;
  p_terms_snapshot: Json;
  p_items: Json;
  p_design_project_id: string;
  p_design_version_id: string;
  p_file_ids: string[];
  p_customer_reference: string;
  p_po_number?: string;
  p_requested_delivery_date: string;
  p_expires_at: string;
};

export type PreparedCustomOrder = {
  requestHash: string;
  rpcArgs: SubmitCustomOrderRpcArgs;
  estimatedTotalPaise: number;
  reservationAmountPaise: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
};

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

async function saveDefaultAddress(input: {
  admin: AdminClient;
  organizationId: string;
  kind: "shipping" | "billing";
  address: SubmitCustomOrderRequest["billing"]["address"];
  contactName: string;
  phone: string;
  gstin?: string;
}) {
  const admin = input.admin as unknown as {
    from: (table: string) => any;
  };

  const flag =
    input.kind === "shipping"
      ? "is_default_shipping"
      : "is_default_billing";

  const { data: existing, error: readError } = await admin
    .from("addresses")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq(flag, true)
    .maybeSingle();

  if (readError) {
    throw new Error(readError.message);
  }

  const values = {
    organization_id: input.organizationId,
    label: input.kind === "shipping" ? "Delivery" : "Billing",
    contact_name: input.contactName,
    phone: phoneE164(input.phone),
    line1: input.address.addressLine1,
    line2: input.address.addressLine2 || null,
    city: input.address.city,
    state: input.address.state,
    postal_code: input.address.zip,
    country_code: "IN",
    gstin: input.gstin || null,
    is_default_shipping: input.kind === "shipping",
    is_default_billing: input.kind === "billing",
  };

  const result = existing
    ? await admin
        .from("addresses")
        .update(values)
        .eq("id", existing.id)
    : await admin.from("addresses").insert(values);

  if (result.error) {
    throw new Error(result.error.message);
  }
}

async function persistCheckoutAccountDetails(input: {
  user: User;
  request: SubmitCustomOrderRequest;
}) {
  const admin = createAdminClient() as unknown as {
    from: (table: string) => any;
  };

  const { user, request } = input;

  const fullName =
    `${request.contact.firstName} ${request.contact.lastName}`.trim();

  const gstin =
    request.billing.gstin ||
    request.company.gstin ||
    null;

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      first_name: request.contact.firstName,
      last_name: request.contact.lastName,
      phone: phoneE164(request.contact.phone),
      department: request.contact.department || null,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (profileError) {
    throw new Error(profileError.message);
  }

  const { error: organizationError } = await admin
    .from("organizations")
    .update({
      gstin,
      billing_email: request.billing.accountsPayableEmail,
      phone: phoneE164(request.contact.phone),
    })
    .eq("id", request.organizationId);

  if (organizationError) {
    if (organizationError.code === "23505") {
      throw new Error(
        "This GSTIN is already linked to another customer account",
      );
    }

    throw new Error(organizationError.message);
  }

  await saveDefaultAddress({
    admin: createAdminClient(),
    organizationId: request.organizationId,
    kind: "shipping",
    address: request.shipping.address,
    contactName: request.shipping.recipientName || fullName,
    phone: request.contact.phone,
  });

  await saveDefaultAddress({
    admin: createAdminClient(),
    organizationId: request.organizationId,
    kind: "billing",
    address: request.billing.address,
    contactName: request.billing.entity || fullName,
    phone: request.contact.phone,
    gstin: gstin || undefined,
  });
}

export async function prepareCustomOrder(input: {
  supabase: SessionClient;
  user: User;
  request: SubmitCustomOrderRequest;
}): Promise<PreparedCustomOrder> {
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
      .select(
        "id, organization_id, status, schema_version, draft_revision, title",
      )
      .eq("id", request.designProjectId)
      .eq("organization_id", request.organizationId)
      .maybeSingle(),

    supabase
      .from("design_project_versions")
      .select(
        "id, version_number, configuration_snapshot, created_at",
      )
      .eq("design_project_id", request.designProjectId)
      .eq("version_number", request.designVersion)
      .maybeSingle(),

    supabase
      .from("profiles")
      .select(
        "first_name, last_name, phone, job_title, department",
      )
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
    throw new Error(
      "Active owner or buyer access is required",
    );
  }

  if (
    projectResult.error ||
    !projectResult.data ||
    projectResult.data.status === "archived"
  ) {
    throw new Error("Design project is unavailable");
  }

  if (versionResult.error || !versionResult.data) {
    throw new Error(
      "Immutable design version is unavailable",
    );
  }

  if (
    profileResult.error ||
    !profileResult.data ||
    !user.email
  ) {
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
    ...(request.purchaseOrderFileId
      ? [request.purchaseOrderFileId]
      : []),
  ];

  const uniqueFileIds = [...new Set(fileIds)];

  if (uniqueFileIds.length) {
    const { data: files, error: filesError } =
      await supabase
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
          file.design_project_id !==
            request.designProjectId ||
          file.uploaded_by !== user.id ||
          file.visibility !== "customer" ||
          file.upload_status !== "finalized" ||
          file.deleted_at !== null ||
          ![
            "customer_artwork",
            "purchase_order",
          ].includes(file.kind) ||
          ![
            "manual_review",
            "clean",
            "not_required",
          ].includes(file.scan_status),
      )
    ) {
      throw new Error(
        "A submitted file is unavailable or not finalized",
      );
    }
  }

  const customerName =
    `${request.contact.firstName} ${request.contact.lastName}`.trim();

  const submittedGstin =
    request.billing.gstin ||
    request.company.gstin;

  const billingSnapshot = {
    entity: request.billing.entity || customerName,
    accountsPayableEmail:
      request.billing.accountsPayableEmail,
    gstin: submittedGstin ?? null,
    address: addressSnapshot(
      request.billing.address,
      request.billing.entity || customerName,
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
    multipleLocations:
      request.shipping.multipleLocations,
    multipleLocationsNotes:
      request.shipping.multipleLocationsNotes ?? null,
  };

  const customerSnapshot = {
    userId: user.id,
    accountEmail: user.email.toLowerCase(),
    email: request.contact.email,
    name: customerName,
    firstName: request.contact.firstName,
    lastName: request.contact.lastName,
    phone: phoneE164(request.contact.phone),
    department:
      request.contact.department ?? null,
  };

  const organization = organizationResult.data;

  const companySnapshot = {
    organizationId: organization.id,
    legalName: organization.legal_name,
    displayName: organization.display_name,
    gstin:
      submittedGstin ??
      organization.gstin,
    pan: organization.pan,
    billingEmail:
      request.billing.accountsPayableEmail,
    phone: phoneE164(request.contact.phone),
    submittedName:
      request.company.name || customerName,
    submittedGstin:
      submittedGstin ?? null,
    industry:
      request.company.industry ??
      organization.industry,
    website:
      request.company.website ??
      organization.website,
    costCentre:
      request.company.costCentre ?? null,
  };

  const termsSnapshot = {
    accepted: true,
    version: request.acceptedTermsVersion,
    acceptedAtServer: new Date().toISOString(),
    reservationCreditedToFinalInvoice:
      getServerEnvironment()
        .RESERVATION_CREDITED_TO_FINAL_INVOICE,
    orderNotes: request.orderNotes ?? null,
    receiveEmails: request.receiveEmails,
    requestedDeliveryDate:
      request.requestedDeliveryDate,
    deliveryType: request.deliveryType,
    designVersionCreatedAt:
      versionResult.data.created_at,
  };

  const requestHash = hashOrderRequest({
    ...request,
    immutableDesignVersionId:
      versionResult.data.id,
    canonicalPrice: {
      subtotalPaise: priced.subtotalPaise,
      shippingPaise: priced.shippingPaise,
      taxEstimatePaise:
        priced.taxEstimatePaise,
    },
  });

  const environment = getServerEnvironment();

  const expiresAt = new Date(
    Date.now() + 24 * 60 * 60 * 1_000,
  ).toISOString();

  await persistCheckoutAccountDetails({
    user,
    request,
  });

  return {
    requestHash,
    estimatedTotalPaise:
      priced.estimatedTotalPaise,
    reservationAmountPaise:
      environment.RESERVATION_AMOUNT_PAISE,
    customerName,
    customerEmail: request.contact.email,
    customerPhone: phoneE164(
      request.contact.phone,
    ),
    rpcArgs: {
      p_idempotency_key:
        request.idempotencyKey,
      p_request_hash: requestHash,
      p_organization_id:
        request.organizationId,
      p_customer_user_id: user.id,
      p_subtotal_paise:
        priced.subtotalPaise,
      p_shipping_paise:
        priced.shippingPaise,
      p_tax_estimate_paise:
        priced.taxEstimatePaise,
      p_reservation_amount_paise:
        environment.RESERVATION_AMOUNT_PAISE,
      p_pricing_version:
        CUSTOM_ORDER_PRICING_VERSION,
      p_configuration_schema_version:
        snapshot.schemaVersion,
      p_billing_snapshot:
        billingSnapshot as Json,
      p_shipping_snapshot:
        shippingSnapshot as Json,
      p_customer_snapshot:
        customerSnapshot as Json,
      p_company_snapshot:
        companySnapshot as Json,
      p_terms_snapshot:
        termsSnapshot as Json,
      p_items: [priced.item] as Json,
      p_design_project_id:
        request.designProjectId,
      p_design_version_id:
        versionResult.data.id,
      p_file_ids: uniqueFileIds,
      p_customer_reference:
        request.projectName,
      p_po_number:
        request.company.poNumber,
      p_requested_delivery_date:
        request.requestedDeliveryDate,
      p_expires_at: expiresAt,
    },
  };
}

export async function submitPreparedCustomOrder(
  prepared: PreparedCustomOrder,
) {
  const admin = createAdminClient();

  const { data, error } = await admin.rpc(
    "submit_custom_order",
    prepared.rpcArgs,
  );

  const result = data?.[0];

  if (error || !result) {
    throw new Error(
      error?.message ??
        "Order could not be submitted",
    );
  }

  return {
    ...result,
    estimatedTotalPaise:
      prepared.estimatedTotalPaise,
    reservationAmountPaise:
      prepared.reservationAmountPaise,
  };
}

function checkoutTables(admin: AdminClient) {
  return admin as unknown as {
    from: (table: string) => any;
  };
}

async function createCheckoutAttempt(input: {
  sessionId: string;
  attemptNumber: number;
  prepared: PreparedCustomOrder;
}) {
  const admin = checkoutTables(
    createAdminClient(),
  );

  const id = randomUUID();

  const merchantTransactionId =
    `G${id.replace(/-/g, "").slice(0, 22)}`;

  const { data, error } = await admin
    .from("custom_checkout_payment_attempts")
    .insert({
      id,
      checkout_session_id: input.sessionId,
      attempt_number: input.attemptNumber,
      provider_merchant_txn_id:
        merchantTransactionId,
      amount_paise:
        input.prepared.reservationAmountPaise,
      currency: "INR",
      status: "created",
      expected_product_info:
        "Garmops reservation fee",
      customer_email:
        input.prepared.customerEmail,
      customer_name:
        input.prepared.customerName,
      customer_phone:
        input.prepared.customerPhone,
    })
    .select("id, status")
    .single();

  if (error || !data) {
    throw new Error(
      error?.message ??
        "Payment attempt could not be prepared",
    );
  }

  return data;
}

export async function prepareCustomCheckout(input: {
  supabase: SessionClient;
  user: User;
  request: SubmitCustomOrderRequest;
  cartId: string;
  returnPath: string;
}) {
  const prepared = await prepareCustomOrder(
    input,
  );

  const admin = checkoutTables(
    createAdminClient(),
  );

  let {
    data: session,
    error: sessionReadError,
  } = await admin
    .from("custom_checkout_sessions")
    .select(
      "id, request_hash, status, final_order_id, final_order_number, final_payment_attempt_id, expires_at",
    )
    .eq(
      "customer_user_id",
      input.user.id,
    )
    .eq(
      "idempotency_key",
      input.request.idempotencyKey,
    )
    .maybeSingle();

  if (sessionReadError) {
    throw new Error(sessionReadError.message);
  }

  if (
    session &&
    session.request_hash !==
      prepared.requestHash
  ) {
    throw new Error(
      "Checkout details changed. Return to Delivery and try again.",
    );
  }

  if (session?.status === "finalized") {
    return {
      checkoutSessionId: session.id,
      checkoutPaymentAttemptId: null,
      alreadyFinalized: true,
      orderNumber:
        session.final_order_number as string,
      orderId:
        session.final_order_id as string,
      paymentAttemptId:
        session.final_payment_attempt_id as string,
    };
  }

  if (!session) {
    const id = randomUUID();

    const insert = await admin
      .from("custom_checkout_sessions")
      .insert({
        id,
        organization_id:
          input.request.organizationId,
        customer_user_id: input.user.id,
        cart_id: input.cartId,
        idempotency_key:
          input.request.idempotencyKey,
        request_hash:
          prepared.requestHash,
        status: "prepared",
        rpc_payload:
          prepared as unknown as Json,
        estimated_total_paise:
          prepared.estimatedTotalPaise,
        reservation_amount_paise:
          prepared.reservationAmountPaise,
        currency: "INR",
        return_path: input.returnPath,
        expires_at:
          prepared.rpcArgs.p_expires_at,
      })
      .select(
        "id, request_hash, status, expires_at",
      )
      .single();

    if (insert.error || !insert.data) {
      if (insert.error?.code === "23505") {
        const retry = await admin
          .from("custom_checkout_sessions")
          .select(
            "id, request_hash, status, final_order_id, final_order_number, final_payment_attempt_id, expires_at",
          )
          .eq(
            "customer_user_id",
            input.user.id,
          )
          .eq(
            "idempotency_key",
            input.request.idempotencyKey,
          )
          .single();

        if (retry.error || !retry.data) {
          throw new Error(
            retry.error?.message ??
              "Checkout could not be prepared",
          );
        }

        session = retry.data;
      } else {
        throw new Error(
          insert.error?.message ??
            "Checkout could not be prepared",
        );
      }
    } else {
      session = insert.data;
    }
  } else {
    const refreshable = [
      "prepared",
      "failed",
      "expired",
    ].includes(session.status);

    if (refreshable) {
      const { error: refreshError } =
        await admin
          .from("custom_checkout_sessions")
          .update({
            status: "prepared",
            rpc_payload:
              prepared as unknown as Json,
            estimated_total_paise:
              prepared.estimatedTotalPaise,
            reservation_amount_paise:
              prepared.reservationAmountPaise,
            return_path: input.returnPath,
            expires_at:
              prepared.rpcArgs.p_expires_at,
          })
          .eq("id", session.id)
          .in("status", [
            "prepared",
            "failed",
            "expired",
          ]);

      if (refreshError) {
        throw new Error(
          refreshError.message,
        );
      }

      session = {
        ...session,
        status: "prepared",
        expires_at:
          prepared.rpcArgs.p_expires_at,
      };
    }
  }

  if (!session) {
    throw new Error(
      "Checkout could not be prepared",
    );
  }

  if (
    new Date(session.expires_at).getTime() <=
    Date.now()
  ) {
    throw new Error(
      "This checkout has expired. Return to Delivery and try again.",
    );
  }

  const {
    data: latest,
    error: latestError,
  } = await admin
    .from("custom_checkout_payment_attempts")
    .select(
      "id, attempt_number, status, amount_paise, provider_payment_id, raw_verified_snapshot",
    )
    .eq(
      "checkout_session_id",
      session.id,
    )
    .order("attempt_number", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    throw new Error(latestError.message);
  }

  if (
    latest?.status === "paid" &&
    latest.provider_payment_id &&
    latest.raw_verified_snapshot
  ) {
    const finalized =
      await finalizeCustomCheckoutPayment({
        checkoutPaymentAttemptId:
          latest.id,
        providerPaymentId:
          latest.provider_payment_id,
        verifiedAmountPaise:
          latest.amount_paise,
        verifiedSnapshot:
          latest.raw_verified_snapshot as Record<
            string,
            unknown
          >,
      });

    return {
      checkoutSessionId: session.id,
      checkoutPaymentAttemptId: null,
      alreadyFinalized: true,
      orderNumber:
        finalized.orderNumber,
      orderId: finalized.orderId,
      paymentAttemptId:
        finalized.paymentAttemptId,
    };
  }

  if (
    latest &&
    [
      "created",
      "initiated",
      "pending",
    ].includes(latest.status)
  ) {
    return {
      checkoutSessionId: session.id,
      checkoutPaymentAttemptId:
        latest.id,
      alreadyFinalized: false,
    };
  }

  const nextAttempt =
    await createCheckoutAttempt({
      sessionId: session.id,
      attemptNumber:
        (latest?.attempt_number ?? 0) +
        1,
      prepared,
    });

  await admin
    .from("custom_checkout_sessions")
    .update({
      status: "prepared",
    })
    .eq("id", session.id);

  return {
    checkoutSessionId: session.id,
    checkoutPaymentAttemptId:
      nextAttempt.id,
    alreadyFinalized: false,
  };
}

export async function finalizeCustomCheckoutPayment(
  input: {
    checkoutPaymentAttemptId: string;
    providerPaymentId: string;
    verifiedAmountPaise: number;
    verifiedSnapshot: Record<
      string,
      unknown
    >;
  },
) {
  const adminClient = createAdminClient();

  const admin =
    checkoutTables(adminClient);

  const {
    data: attempt,
    error: attemptError,
  } = await admin
    .from("custom_checkout_payment_attempts")
    .select(
      "id, checkout_session_id, amount_paise, currency, provider_merchant_txn_id, status, custom_checkout_sessions!inner(id, status, rpc_payload, final_order_id, final_order_number, final_payment_attempt_id)",
    )
    .eq(
      "id",
      input.checkoutPaymentAttemptId,
    )
    .single();

  if (attemptError || !attempt) {
    throw new Error(
      attemptError?.message ??
        "Checkout payment attempt was not found",
    );
  }

  if (
    attempt.amount_paise !==
      input.verifiedAmountPaise ||
    attempt.currency !== "INR"
  ) {
    throw new Error(
      "Verified PayU amount does not match the checkout",
    );
  }

  const session =
    attempt.custom_checkout_sessions as {
      id: string;
      status: string;
      rpc_payload: PreparedCustomOrder;
      final_order_id: string | null;
      final_order_number: string | null;
      final_payment_attempt_id:
        | string
        | null;
    };

  if (
    session.status === "finalized" &&
    session.final_order_number &&
    session.final_payment_attempt_id
  ) {
    return {
      orderId: session.final_order_id!,
      orderNumber:
        session.final_order_number,
      paymentAttemptId:
        session.final_payment_attempt_id,
      alreadyFinalized: true,
    };
  }

  await admin
    .from("custom_checkout_payment_attempts")
    .update({
      status: "paid",
      provider_payment_id:
        input.providerPaymentId,
      paid_at: new Date().toISOString(),
      raw_verified_snapshot:
        input.verifiedSnapshot,
      failure_code: null,
      failure_message: null,
    })
    .eq("id", attempt.id)
    .in("status", [
      "created",
      "initiated",
      "pending",
      "failed",
      "paid",
    ]);

  await admin
    .from("custom_checkout_sessions")
    .update({
      status: "payment_verified",
      provider_payment_id:
        input.providerPaymentId,
      verified_snapshot:
        input.verifiedSnapshot,
    })
    .eq("id", session.id)
    .neq("status", "finalized");

  const prepared =
    session.rpc_payload;

  const order =
    await submitPreparedCustomOrder(
      prepared,
    );

  const { error: txnUpdateError } =
    await adminClient
      .from("payment_attempts")
      .update({
        provider_merchant_txn_id:
          attempt.provider_merchant_txn_id,
      })
      .eq(
        "id",
        order.payment_attempt_id,
      );

  if (txnUpdateError) {
    throw new Error(
      txnUpdateError.message,
    );
  }

  const { error: finalizeError } =
    await adminClient.rpc(
      "finalize_verified_payment",
      {
        p_payment_attempt_id:
          order.payment_attempt_id,
        p_provider_payment_id:
          input.providerPaymentId,
        p_verified_amount_paise:
          input.verifiedAmountPaise,
        p_currency: "INR",
        p_verified_snapshot:
          input.verifiedSnapshot as Json,
        p_invoice_kind:
          "reservation_invoice",
      },
    );

  if (finalizeError) {
    throw new Error(
      finalizeError.message,
    );
  }

  const finalizedAt =
    new Date().toISOString();

  const {
    error: sessionUpdateError,
  } = await admin
    .from("custom_checkout_sessions")
    .update({
      status: "finalized",
      final_order_id: order.order_id,
      final_order_number:
        order.order_number,
      final_payment_attempt_id:
        order.payment_attempt_id,
      finalized_at: finalizedAt,
    })
    .eq("id", session.id);

  if (sessionUpdateError) {
    throw new Error(
      sessionUpdateError.message,
    );
  }

  await admin
    .from("custom_checkout_payment_attempts")
    .update({
      status: "completed",
      completed_at: finalizedAt,
    })
    .eq("id", attempt.id);

  return {
    orderId: order.order_id,
    orderNumber: order.order_number,
    paymentAttemptId:
      order.payment_attempt_id,
    alreadyFinalized: false,
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

  const { data, error } = await admin.rpc(
    "retry_order_payment",
    {
      p_order_id: input.orderId,
      p_customer_user_id:
        input.userId,
      p_idempotency_key:
        input.idempotencyKey,
      p_request_hash: requestHash,
    },
  );

  const result = data?.[0];

  if (error || !result) {
    throw new Error(
      error?.message ??
        "Payment retry could not be prepared",
    );
  }

  return result;
}