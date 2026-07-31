"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { externalApprovalResponseSchema } from "@/lib/domain/order-lifecycle/schema";
import { hashApprovalNetworkValue, hashApprovalToken } from "@/lib/domain/approvals/approval";

export async function externalApprovalResponseAction(formData: FormData) {
  const parsed = externalApprovalResponseSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirect("/approve/invalid?result=invalid");
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = requestHeaders.get("user-agent")?.slice(0, 500) ?? null;
  const admin = createAdminClient();
  const { data, error } = await (admin.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>)("external_respond_order_approval", {
    p_secure_token_hash: hashApprovalToken(parsed.data.token),
    p_decision: parsed.data.decision,
    p_response_note: parsed.data.responseNote ?? null,
    p_ip_hash: hashApprovalNetworkValue(forwarded),
    p_user_agent_summary: userAgent,
  });
  if (error || !data) redirect(`/approve/${encodeURIComponent(parsed.data.token)}?result=error`);
  redirect(`/approve/${encodeURIComponent(parsed.data.token)}?result=${parsed.data.decision}`);
}
