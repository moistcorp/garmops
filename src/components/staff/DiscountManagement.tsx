import TechpackPageHeader from "@/components/portal/TechpackPageHeader";
import DiscountCodeForm from "@/components/staff/DiscountCodeForm";
import { requireStaffPermission } from "@/lib/auth/guards";
import { formatMoneyPaise } from "@/lib/orders/format";
import type { Tables } from "@/types/database.generated";
type DiscountRow = Pick<Tables<"discount_codes">, "id" | "code" | "description" | "kind" | "percentage_basis_points" | "fixed_amount_paise" | "minimum_subtotal_paise" | "maximum_redemptions" | "active" | "starts_at" | "ends_at" | "created_at">;
export default async function DiscountManagement() {
  const { supabase } = await requireStaffPermission("manage_discounts");
  const result = await supabase.from("discount_codes").select("id, code, description, kind, percentage_basis_points, fixed_amount_paise, minimum_subtotal_paise, maximum_redemptions, active, starts_at, ends_at, created_at").order("created_at", { ascending: false });
  const codes = (result.data ?? []) as unknown as DiscountRow[];
  return <div className="space-y-5"><TechpackPageHeader eyebrow="Founder" reference="Checkout pricing" title="Discount codes" description="Only Founder can create discount codes. Customers apply valid codes before the PayU amount is created." /><div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]"><section className="techpack-surface rounded border p-5"><h2 className="font-semibold">Create code</h2><div className="mt-4"><DiscountCodeForm /></div></section><section className="techpack-surface rounded border p-5"><h2 className="font-semibold">Codes</h2><div className="mt-4 divide-y divide-black/10">{codes.length ? codes.map((code) => <div key={code.id} className="flex flex-wrap justify-between gap-3 py-4"><div><p className="font-mono font-semibold">{code.code}</p><p className="mt-1 text-xs text-black/45">{code.description || "No description"}</p></div><div className="text-right"><p className="text-sm font-semibold">{code.kind === "percentage" ? `${Number(code.percentage_basis_points ?? 0) / 100}%` : formatMoneyPaise(Number(code.fixed_amount_paise ?? 0))}</p><p className="text-xs text-black/40">Min. {formatMoneyPaise(code.minimum_subtotal_paise)} · {code.active ? "Active" : "Inactive"}</p></div></div>) : <p className="py-10 text-center text-sm text-black/45">No discount codes.</p>}</div></section></div></div>;
}
