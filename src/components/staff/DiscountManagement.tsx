import TechpackPageHeader from "@/components/portal/TechpackPageHeader";
import { requireStaffPermission } from "@/lib/auth/guards";
export default async function DiscountManagement() { await requireStaffPermission("manage_discounts"); return <div className="space-y-5"><TechpackPageHeader eyebrow="Founder" reference="Backend contract" title="Discount codes" description="Customer-entered promotion codes are not available in the Stage 3 Medusa contract. Automatic line volume pricing remains backend-authoritative."/></div>; }
