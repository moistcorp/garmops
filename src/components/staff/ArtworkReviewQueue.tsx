import TechpackPageHeader from "@/components/portal/TechpackPageHeader";
import { requireStaffPermission } from "@/lib/auth/guards";

export default async function ArtworkReviewQueue() {
  await requireStaffPermission("review_artwork");
  return <div className="space-y-5"><TechpackPageHeader eyebrow="Foundry" reference="Medusa artwork gate" title="Artwork review" description="Artwork review is performed from an order’s frozen production record after the backend scan gate reports a clean file."/><section className="techpack-surface rounded border p-6"><p className="text-sm text-black/55">Open an order from the queue to review its backend-controlled artwork state.</p></section></div>;
}
