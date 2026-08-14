import TechpackPageHeader from "@/components/portal/TechpackPageHeader";
import { requireStaffPermission } from "@/lib/auth/guards";
export default async function StaffPayments() { const context = await requireStaffPermission("view_all_orders"); return <div className="space-y-5"><TechpackPageHeader eyebrow="Foundry" reference="Medusa payment register" title="Payments" description={context.role === "founder" ? "Founder payment inspection is available through the protected Medusa payment route." : "Operations sees only safe payment state; provider secrets remain restricted."}/></div>; }
