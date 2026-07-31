import Link from "next/link";
import { FileText } from "lucide-react";

import { requireStaffPermission } from "@/lib/auth/guards";
import { formatOrderTimestamp } from "@/lib/orders/format";
import PrivateFileDownloadButton from "@/components/staff/PrivateFileDownloadButton";

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function StaffFiles({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const { supabase } = await requireStaffPermission("view_all_orders");
  const kind = one(searchParams.kind) ?? "";
  const visibility = one(searchParams.visibility) ?? "";
  const scan = one(searchParams.scan) ?? "";
  let query = supabase.from("order_files").select("id, kind, visibility, original_filename, content_type, byte_size, scan_status, provider_source, created_at, orders(order_number, organizations(display_name))").not("order_id", "is", null).is("deleted_at", null).order("created_at", { ascending: false }).limit(200);
  if (kind) query = query.eq("kind", kind as never);
  if (visibility) query = query.eq("visibility", visibility as never);
  if (scan) query = query.eq("scan_status", scan as never);
  const { data, error } = await query;

  return <div className="space-y-5">
    <section className="techpack-surface rounded-[4px] border p-6"><div className="flex items-center gap-2"><FileText size={18} className="text-[#1D49B4]" /><h1 className="text-xl font-semibold">Order files</h1></div><form method="get" className="mt-5 grid gap-3 sm:grid-cols-3"><select name="kind" defaultValue={kind} className="rounded-[4px] border border-black/10 bg-white px-3 py-2 text-sm"><option value="">All file types</option>{['customer_artwork','purchase_order','approval_pdf','proof','invoice_pdf','qc_photo','packing_list','shipping_label','shipment_document','other'].map((value) => <option key={value} value={value}>{value.replaceAll('_',' ')}</option>)}</select><select name="visibility" defaultValue={visibility} className="rounded-[4px] border border-black/10 bg-white px-3 py-2 text-sm"><option value="">All visibility</option><option value="customer">Customer</option><option value="staff_only">Staff only</option></select><select name="scan" defaultValue={scan} className="rounded-[4px] border border-black/10 bg-white px-3 py-2 text-sm"><option value="">All scan states</option>{['pending','clean','rejected','manual_review','not_required'].map((value) => <option key={value} value={value}>{value.replaceAll('_',' ')}</option>)}</select><button className="rounded-[4px] bg-[#16212B] px-4 py-2 text-xs font-semibold text-white sm:col-span-3 sm:justify-self-start">Apply filters</button></form></section>
    <section className="techpack-surface rounded-[4px] border p-6">{error ? <p className="text-sm text-red-700">Files could not be loaded.</p> : <div className="space-y-3">{data?.length ? data.map((file) => { const order = file.orders as unknown as { order_number: string; organizations: { display_name: string } | null }; return <article key={file.id} className="flex flex-col gap-4 rounded-[4px] border border-black/8 bg-white p-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-semibold">{file.original_filename}</p><p className="mt-1 text-xs capitalize text-black/45">{file.kind.replaceAll('_',' ')} · {file.visibility.replaceAll('_',' ')} · {file.scan_status.replaceAll('_',' ')}</p><p className="mt-2 text-xs text-black/35"><Link href={`/staff/orders/${order.order_number}`} className="font-semibold text-[#1D49B4] hover:underline">{order.order_number}</Link> · {order.organizations?.display_name ?? "Customer"} · {formatOrderTimestamp(file.created_at)}</p></div>{file.scan_status === "clean" || file.scan_status === "not_required" ? <PrivateFileDownloadButton fileId={file.id} /> : <span className="rounded-[4px] bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">Awaiting security review</span>}</article>; }) : <p className="py-10 text-center text-sm text-black/40">No files match these filters.</p>}</div>}</section>
  </div>;
}
