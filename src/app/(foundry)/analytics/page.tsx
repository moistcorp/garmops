import TechpackPageHeader from "@/components/portal/TechpackPageHeader";
import { requireStaffPermission } from "@/lib/auth/guards";
export default async function FoundryAnalyticsPage() { await requireStaffPermission("view_raw_payments"); return <div className="space-y-5"><TechpackPageHeader eyebrow="Founder" reference="Medusa operations" title="Business analytics" description="Analytics dashboards will consume Medusa reporting data when that reporting surface is enabled."/></div>; }
