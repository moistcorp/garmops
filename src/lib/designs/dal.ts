import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/types/database.generated";

type DesignClient = SupabaseClient<Database>;

export async function findWritableOrganization(
  supabase: DesignClient,
  userId: string,
) {
  return supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId)
    .eq("status", "active")
    .in("role", ["owner", "buyer"])
    .order("created_at")
    .limit(1)
    .maybeSingle();
}

export async function listCloudDesigns(
  supabase: DesignClient,
  includeArchived = false,
) {
  let query = supabase
    .from("design_projects")
    .select(
      "id, title, status, schema_version, current_version, draft_revision, draft_snapshot, source, last_saved_at, created_at, updated_at, archived_at",
    )
    .order("updated_at", { ascending: false })
    .limit(100);

  if (!includeArchived) query = query.neq("status", "archived");
  return query;
}

export async function getCloudDesign(
  supabase: DesignClient,
  designProjectId: string,
) {
  return Promise.all([
    supabase
      .from("design_projects")
      .select(
        "id, organization_id, created_by, title, status, schema_version, current_version, draft_revision, draft_snapshot, pricing_input_snapshot, source, last_saved_at, submitted_at, archived_at, created_at, updated_at",
      )
      .eq("id", designProjectId)
      .maybeSingle(),
    supabase
      .from("design_project_versions")
      .select("id, version_number, created_by, created_at")
      .eq("design_project_id", designProjectId)
      .order("version_number", { ascending: false })
      .limit(100),
    supabase
      .from("orders")
      .select("id, order_number, design_version_id, status, submitted_at")
      .eq("design_project_id", designProjectId)
      .order("submitted_at", { ascending: false })
      .limit(100),
  ]);
}

export async function createCloudDesign(
  supabase: DesignClient,
  input: {
    organizationId: string;
    title: string;
    schemaVersion: number;
    snapshot: Json;
    pricingSnapshot?: Json;
    source: string;
    clientImportId?: string;
  },
) {
  return supabase.rpc("create_cloud_design", {
    p_organization_id: input.organizationId,
    p_title: input.title,
    p_schema_version: input.schemaVersion,
    p_configuration_snapshot: input.snapshot,
    p_pricing_input_snapshot:
      input.pricingSnapshot ?? (null as unknown as Json),
    p_source: input.source,
    p_client_import_id:
      input.clientImportId ?? (null as unknown as string),
  });
}

export async function saveCloudDesignDraft(
  supabase: DesignClient,
  designProjectId: string,
  input: {
    expectedRevision: number;
    schemaVersion: number;
    snapshot: Json;
    pricingSnapshot?: Json;
    title?: string;
  },
) {
  return supabase.rpc("save_cloud_design_draft", {
    p_design_project_id: designProjectId,
    p_expected_revision: input.expectedRevision,
    p_schema_version: input.schemaVersion,
    p_configuration_snapshot: input.snapshot,
    p_pricing_input_snapshot:
      input.pricingSnapshot ?? (null as unknown as Json),
    p_title: input.title ?? (null as unknown as string),
  });
}

export async function createCloudDesignVersion(
  supabase: DesignClient,
  designProjectId: string,
  expectedRevision: number,
) {
  return supabase.rpc("create_cloud_design_version", {
    p_design_project_id: designProjectId,
    p_expected_revision: expectedRevision,
  });
}

export async function duplicateCloudDesign(
  supabase: DesignClient,
  designProjectId: string,
  title: string,
  clientOperationId: string,
) {
  return supabase.rpc("duplicate_cloud_design", {
    p_design_project_id: designProjectId,
    p_title: title,
    p_client_operation_id: clientOperationId,
  });
}

export async function archiveCloudDesign(
  supabase: DesignClient,
  designProjectId: string,
  expectedRevision: number,
) {
  return supabase.rpc("archive_cloud_design", {
    p_design_project_id: designProjectId,
    p_expected_revision: expectedRevision,
  });
}
