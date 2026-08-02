import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";

type EstimateClient = SupabaseClient<Database>;

const estimateSelect = "id, organization_id, created_by, design_project_id, design_version_id, design_revision, estimate_number, status, currency, pricing_engine_version, pricing_snapshot, subtotal_paise, discount_paise, taxable_subtotal_paise, gst_rate_basis_points, gst_paise, shipping_paise, total_paise, reservation_fee_paise, balance_due_paise, generated_at, valid_until, converted_order_id, client_operation_id, created_at";

export function listDesignEstimates(client: EstimateClient, designId: string, userId: string) {
  return client.from("design_estimates").select(estimateSelect).eq("design_project_id", designId).eq("created_by", userId).order("generated_at", { ascending: false }).limit(30);
}

export function getEstimate(client: EstimateClient, estimateId: string, userId: string) {
  return client.from("design_estimates").select(estimateSelect).eq("id", estimateId).eq("created_by", userId).maybeSingle();
}
