import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database.generated";
type DesignClient = SupabaseClient<Database>;

export async function listCloudDesigns(supabase: DesignClient, userId: string, includeArchived = false) {
  let query = supabase.from("design_projects").select("id, title, status, schema_version, current_version, draft_revision, draft_snapshot, source, last_saved_at, created_at, updated_at, archived_at").eq("created_by", userId).order("updated_at", { ascending: false }).limit(100);
  if (!includeArchived) query = query.neq("status", "archived"); return query;
}
export async function getCloudDesign(supabase: DesignClient, designProjectId: string, userId: string) {
  return Promise.all([
    supabase.from("design_projects").select("id, created_by, title, status, schema_version, current_version, draft_revision, draft_snapshot, pricing_input_snapshot, source, last_saved_at, submitted_at, archived_at, created_at, updated_at").eq("id", designProjectId).eq("created_by", userId).maybeSingle(),
    supabase.from("design_project_versions").select("id, version_number, created_by, created_at").eq("design_project_id", designProjectId).order("version_number", { ascending: false }).limit(100),
    supabase.from("orders").select("id, order_number, design_version_id, public_status, confirmed_at").eq("design_project_id", designProjectId).eq("customer_user_id", userId).order("confirmed_at", { ascending: false }).limit(100),
  ]);
}
export async function createCloudDesign(supabase: DesignClient, input: { title: string; schemaVersion: number; snapshot: Json; pricingSnapshot?: Json; source: string; clientImportId?: string }) {
  return supabase.rpc("create_cloud_design", { p_title: input.title, p_schema_version: input.schemaVersion, p_configuration_snapshot: input.snapshot, p_pricing_input_snapshot: input.pricingSnapshot ?? null, p_source: input.source, p_client_import_id: input.clientImportId });
}
export async function saveCloudDesignDraft(supabase: DesignClient, designProjectId: string, input: { expectedRevision: number; schemaVersion: number; snapshot: Json; pricingSnapshot?: Json; title?: string }) { return supabase.rpc("save_cloud_design_draft", { p_design_project_id: designProjectId, p_expected_revision: input.expectedRevision, p_schema_version: input.schemaVersion, p_configuration_snapshot: input.snapshot, p_pricing_input_snapshot: input.pricingSnapshot ?? null, p_title: input.title }); }
export async function createCloudDesignVersion(supabase: DesignClient, designProjectId: string, expectedRevision: number) { return supabase.rpc("create_cloud_design_version", { p_design_project_id: designProjectId, p_expected_revision: expectedRevision }); }
export async function duplicateCloudDesign(supabase: DesignClient, designProjectId: string, title: string, clientOperationId: string) { return supabase.rpc("duplicate_cloud_design", { p_design_project_id: designProjectId, p_title: title, p_client_operation_id: clientOperationId }); }
export async function archiveCloudDesign(supabase: DesignClient, designProjectId: string, expectedRevision: number) { return supabase.rpc("archive_cloud_design", { p_design_project_id: designProjectId, p_expected_revision: expectedRevision }); }
