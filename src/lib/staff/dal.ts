import "server-only";

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.generated";

import type { OrderStatus, PublicOrderStatus } from "./statuses";

type StaffClient = SupabaseClient<Database>;
type PaymentStatus = Database["public"]["Enums"]["payment_status"];
type InvoiceStatus = Database["public"]["Enums"]["invoice_sync_status"];
type OrderType = Database["public"]["Enums"]["order_type"];

type RpcResult = Promise<{ data: unknown; error: PostgrestError | null }>;
type RpcCaller = (name: string, args?: Record<string, unknown>) => RpcResult;

function rpc(supabase: StaffClient, name: string, args?: Record<string, unknown>) {
  return (supabase.rpc as unknown as RpcCaller)(name, args);
}

function singleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function boolParam(value: string | string[] | undefined) {
  return singleParam(value) === "true";
}

function integerParam(value: string | string[] | undefined, fallback: number) {
  const parsed = Number.parseInt(singleParam(value) ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export type StaffQueueFilters = {
  query?: string;
  status?: OrderStatus;
  publicStatus?: PublicOrderStatus;
  orderType?: OrderType;
  priority?: "low" | "normal" | "high" | "urgent";
  paymentState?: PaymentStatus;
  invoiceState?: InvoiceStatus;
  assignee?: string;
  team?: string;
  missing?: "artwork" | "po" | "gstin" | "approval";
  shipmentState?: string;
  dateFrom?: string;
  dateTo?: string;
  overdue: boolean;
  atRisk: boolean;
  myOrders: boolean;
  page: number;
};

export function parseStaffQueueFilters(
  params: Record<string, string | string[] | undefined>,
): StaffQueueFilters {
  return {
    query: singleParam(params.q)?.trim().slice(0, 120) || undefined,
    status: singleParam(params.status) as OrderStatus | undefined,
    publicStatus: singleParam(params.publicStatus) as
      | PublicOrderStatus
      | undefined,
    orderType: singleParam(params.orderType) as OrderType | undefined,
    priority: singleParam(params.priority) as StaffQueueFilters["priority"],
    paymentState: singleParam(params.paymentState) as PaymentStatus | undefined,
    invoiceState: singleParam(params.invoiceState) as InvoiceStatus | undefined,
    assignee: singleParam(params.assignee) || undefined,
    team: singleParam(params.team)?.trim().slice(0, 80) || undefined,
    missing: singleParam(params.missing) as StaffQueueFilters["missing"],
    shipmentState: singleParam(params.shipmentState)?.trim().slice(0, 40) || undefined,
    dateFrom: singleParam(params.dateFrom) || undefined,
    dateTo: singleParam(params.dateTo) || undefined,
    overdue: boolParam(params.overdue),
    atRisk: boolParam(params.atRisk),
    myOrders: boolParam(params.myOrders),
    page: Math.max(1, integerParam(params.page, 1)),
  };
}

export type StaffQueueRow = {
  order_id: string;
  order_number: string;
  order_type: OrderType;
  status: OrderStatus;
  public_status: PublicOrderStatus;
  internal_priority: string;
  assigned_staff_user_id: string | null;
  assigned_team: string | null;
  assignee_name: string | null;
  submitted_at: string;
  updated_at: string;
  requested_delivery_date: string | null;
  expected_approval_at: string | null;
  expected_production_at: string | null;
  expected_qc_at: string | null;
  estimated_dispatch_at: string | null;
  organization_id: string;
  organization_name: string;
  customer_name: string;
  customer_email: string | null;
  po_number: string | null;
  quantity_total: number;
  payment_status: PaymentStatus | null;
  invoice_status: InvoiceStatus | null;
  shipment_status: string | null;
  open_action_count: number;
  total_count: number;
};

export async function searchStaffOrders(
  supabase: StaffClient,
  filters: StaffQueueFilters,
  pageSize = 40,
) {
  const { data, error } = await rpc(supabase, "staff_search_orders", {
    p_query: filters.query ?? null,
    p_status: filters.status ?? null,
    p_public_status: filters.publicStatus ?? null,
    p_order_type: filters.orderType ?? null,
    p_priority: filters.priority ?? null,
    p_payment_state: filters.paymentState ?? null,
    p_invoice_state: filters.invoiceState ?? null,
    p_assignee: filters.assignee ?? null,
    p_team: filters.team ?? null,
    p_missing: filters.missing ?? null,
    p_shipment_state: filters.shipmentState ?? null,
    p_date_from: filters.dateFrom ?? null,
    p_date_to: filters.dateTo ?? null,
    p_overdue: filters.overdue,
    p_at_risk: filters.atRisk,
    p_my_orders: filters.myOrders,
    p_limit: pageSize,
    p_offset: (filters.page - 1) * pageSize,
  });

  if (error) throw new Error(`Staff order queue failed: ${error.message}`);
  return (data ?? []) as StaffQueueRow[];
}

export type StaffDashboardMetrics = {
  newPaidReservations: number;
  newPaidSampleOrders: number;
  actionRequired: number;
  artworkOverdue: number;
  productionAtRisk: number;
  readyForQcDispatch: number;
  invoiceExceptions: number;
  pendingPayu: number;
  unassignedPriority: number;
};

const emptyDashboard: StaffDashboardMetrics = {
  newPaidReservations: 0,
  newPaidSampleOrders: 0,
  actionRequired: 0,
  artworkOverdue: 0,
  productionAtRisk: 0,
  readyForQcDispatch: 0,
  invoiceExceptions: 0,
  pendingPayu: 0,
  unassignedPriority: 0,
};

export async function getStaffDashboardMetrics(supabase: StaffClient) {
  const { data, error } = await rpc(supabase, "staff_dashboard_metrics");
  if (error || !data || typeof data !== "object") return emptyDashboard;
  return { ...emptyDashboard, ...(data as Partial<StaffDashboardMetrics>) };
}

export type AssignableStaff = {
  user_id: string;
  role: Database["public"]["Enums"]["staff_role"];
  team: string | null;
  display_name: string;
};

export async function listAssignableStaff(supabase: StaffClient) {
  const { data, error } = await rpc(supabase, "staff_list_assignable_members");
  if (error) return [];
  return (data ?? []) as AssignableStaff[];
}

export type SafePaymentSummary = {
  status: PaymentStatus;
  amount_paise: number;
  paid_at: string | null;
  attempt_count: number;
};

export async function getSafePaymentSummary(
  supabase: StaffClient,
  orderId: string,
) {
  const { data, error } = await rpc(supabase, "staff_safe_payment_summary", {
    p_order_id: orderId,
  });
  if (error) return null;
  return ((data as SafePaymentSummary[] | null) ?? [])[0] ?? null;
}

export type StaffApproval = {
  id: string;
  design_version_id: string;
  approval_pdf_file_id: string | null;
  status: string;
  requested_from_user_id: string | null;
  requested_from_email: string | null;
  expires_at: string | null;
  viewed_at: string | null;
  responded_at: string | null;
  response_note: string | null;
  snapshot_sha256: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type StaffShipmentEvent = {
  id: string;
  shipment_id: string;
  status: string;
  occurred_at: string;
  location: string | null;
  customer_message: string | null;
  internal_note: string | null;
};

export type StaffOrder = Database["public"]["Tables"]["orders"]["Row"] & {
  organizations: {
    id: string;
    display_name: string;
    legal_name: string;
    gstin: string | null;
    zoho_contact_id: string | null;
  } | null;
};

export async function getStaffOrderWorkspace(
  supabase: StaffClient,
  orderNumber: string,
) {
  const orderResult = await supabase
    .from("orders")
    .select(
      "*, organizations(id, display_name, legal_name, gstin, zoho_contact_id)",
    )
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (orderResult.error || !orderResult.data) {
    return { order: null, error: orderResult.error };
  }

  const order = orderResult.data as unknown as StaffOrder;
  const [
    items,
    history,
    comments,
    files,
    approvals,
    shipments,
    invoices,
    audit,
    approvers,
    designVersions,
    payment,
    assignees,
  ] = await Promise.all([
    supabase
      .from("order_items")
      .select(
        "id, line_number, product_name, product_snapshot, colour_snapshot, decoration_snapshot, artwork_snapshot, neck_label_snapshot, size_breakdown, quantity, unit_price_paise, line_total_paise",
      )
      .eq("order_id", order.id)
      .order("line_number"),
    supabase
      .from("order_status_history")
      .select(
        "id, from_status, to_status, public_status, actor_type, actor_user_id, customer_visible, customer_message, internal_note, metadata, created_at",
      )
      .eq("order_id", order.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("order_comments")
      .select(
        "id, author_user_id, visibility, body, action_required, action_type, resolved_at, resolved_by, created_at, updated_at",
      )
      .eq("order_id", order.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("order_files")
      .select(
        "id, kind, visibility, original_filename, safe_filename, content_type, byte_size, scan_status, upload_status, sha256, version_number, provider_source, created_at",
      )
      .eq("order_id", order.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    rpc(supabase, "staff_order_approvals", { p_order_id: order.id }),
    supabase
      .from("shipments")
      .select(
        "id, shipment_number, carrier, tracking_number, tracking_url, status, package_count, dispatched_at, estimated_delivery_at, delivered_at, customer_visible_note, created_at",
      )
      .eq("order_id", order.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("invoices")
      .select(
        "id, kind, sync_status, document_number, total_paise, paid_paise, balance_paise, pdf_file_id, last_error_code, last_error_message, created_at, updated_at",
      )
      .eq("order_id", order.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("audit_logs")
      .select(
        "id, actor_user_id, actor_type, action, target_type, target_id, before_state, after_state, created_at",
      )
      .eq("order_id", order.id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("organization_members")
      .select("user_id, role, profiles(first_name, last_name)")
      .eq("organization_id", order.organization_id)
      .eq("status", "active")
      .in("role", ["owner", "approver"]),
    supabase
      .from("design_project_versions")
      .select("id, version_number, created_at")
      .eq("design_project_id", order.design_project_id ?? "00000000-0000-0000-0000-000000000000")
      .order("version_number", { ascending: false }),
    getSafePaymentSummary(supabase, order.id),
    listAssignableStaff(supabase),
  ]);

  const shipmentIds = (shipments.data ?? []).map((shipment) => shipment.id);
  const shipmentEvents = shipmentIds.length
    ? await ((supabase.from as unknown as (relation: string) => {
        select: (columns: string) => { in: (column: string, values: string[]) => { order: (column: string, options: { ascending: boolean }) => Promise<{ data: StaffShipmentEvent[] | null; error: PostgrestError | null }> } };
      })("shipment_events")).select("id, shipment_id, status, occurred_at, location, customer_message, internal_note").in("shipment_id", shipmentIds).order("occurred_at", { ascending: false })
    : { data: [], error: null };

  const approvalMembers = (approvers.data ?? []).map((member) => {
    const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
    return {
      user_id: member.user_id,
      role: member.role,
      display_name: `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() || member.user_id,
    };
  });

  return {
    order,
    items: items.data ?? [],
    history: history.data ?? [],
    comments: comments.data ?? [],
    files: files.data ?? [],
    approvals: (approvals.data ?? []) as StaffApproval[],
    approvers: approvalMembers,
    designVersions: designVersions.data ?? [],
    shipments: shipments.data ?? [],
    shipmentEvents: shipmentEvents.data ?? [],
    invoices: invoices.data ?? [],
    audit: audit.data ?? [],
    payment,
    assignees,
    error:
      items.error ??
      history.error ??
      comments.error ??
      files.error ??
      approvals.error ??
      approvers.error ??
      designVersions.error ??
      shipments.error ??
      shipmentEvents.error ??
      invoices.error,
  };
}
