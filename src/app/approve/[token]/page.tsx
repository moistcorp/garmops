import { notFound } from "next/navigation";
import { CheckCircle2, FileText, ShieldCheck } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashApprovalToken } from "@/lib/domain/approvals/approval";
import { externalApprovalResponseAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ExternalApprovalPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ result?: string }>;
}) {
  const { token } = await params;
  const { result } = await searchParams;
  if (token.length < 32 || token.length > 512) return notFound();
  const admin = createAdminClient();
  const hash = hashApprovalToken(token);
  const { data: approval } = await admin
    .from("approvals")
    .select("id, order_id, status, expires_at, requested_from_email, approval_pdf_file_id, response_note, viewed_at, orders(order_number, organization_id, organizations(display_name))")
    .eq("secure_token_hash", hash)
    .maybeSingle();
  if (!approval) return notFound();
  const nowIso = new Date().toISOString();
  const active = ["requested", "viewed"].includes(approval.status) && Boolean(approval.expires_at) && (approval.expires_at as string) > nowIso;
  const order = approval.orders as unknown as { order_number: string; organization_id: string; organizations: { display_name: string } | null };

  if (active && approval.status === "requested") {
    const { data: viewed } = await admin.from("approvals").update({ status: "viewed", viewed_at: new Date().toISOString() }).eq("id", approval.id).eq("status", "requested").select("id").maybeSingle();
    if (viewed) await admin.from("audit_logs").insert({ actor_type: "customer", action: "approval.viewed", target_type: "approval", target_id: approval.id, organization_id: order.organization_id, order_id: approval.order_id, after_state: { channel: "external_link" } });
  }

  const completed = ["approved", "changes_requested"].includes(result ?? "") || ["approved", "changes_requested"].includes(approval.status);
  const decision = result === "approved" || approval.status === "approved" ? "approved" : result === "changes_requested" || approval.status === "changes_requested" ? "changes requested" : null;

  return <main className="min-h-screen bg-[#eef3f2] px-4 py-12 text-[#16212B]">
    <div className="mx-auto max-w-2xl space-y-6">
      <section className="rounded-3xl border border-white/70 bg-white/75 p-6 shadow-xl backdrop-blur-xl sm:p-9">
        <div className="flex items-center gap-2 text-[#315F66]"><ShieldCheck size={19} /><span className="text-xs font-semibold uppercase tracking-wider">Secure versioned approval</span></div>
        <h1 className="mt-5 text-2xl font-semibold">Artwork approval for {order.order_number}</h1>
        <p className="mt-2 text-sm text-black/55">{order.organizations?.display_name ?? "Garmops customer"}</p>
        <p className="mt-5 text-sm leading-relaxed text-black/60">This request applies only to the immutable PDF and design version linked below. Approving it does not approve later artwork changes.</p>
        <a href={`/api/approvals/external/${encodeURIComponent(token)}/document`} className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#16212B] px-5 py-3 text-sm font-semibold text-white"><FileText size={16} /> Download approval PDF</a>
      </section>

      {completed ? <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6"><div className="flex items-center gap-2 font-semibold text-emerald-800"><CheckCircle2 size={19} /> Decision recorded</div><p className="mt-2 text-sm text-emerald-800/75">This version was {decision}. Download the PDF while this secure link remains available if you need a copy for your records.</p></section> : active ? <section className="rounded-3xl border border-white/70 bg-white/75 p-6 shadow-xl backdrop-blur-xl sm:p-9"><form action={externalApprovalResponseAction} className="space-y-4"><input type="hidden" name="token" value={token} /><label className="block text-sm font-medium">Decision<select name="decision" className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-3"><option value="approved">Approve this exact version</option><option value="changes_requested">Request changes</option></select></label><label className="block text-sm font-medium">Note<textarea name="responseNote" rows={4} className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-3" placeholder="Add a clear reason when requesting changes." /></label><button className="rounded-full bg-[#16212B] px-5 py-3 text-sm font-semibold text-white">Submit secure decision</button></form>{result === "error" ? <p className="mt-3 text-sm text-red-700">The decision could not be recorded. The link may have expired or already been used.</p> : null}</section> : <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6"><p className="font-semibold text-amber-900">This approval link is no longer active.</p><p className="mt-2 text-sm text-amber-800">Ask the Garmops team for a new request if another decision is required.</p></section>}
    </div>
  </main>;
}
