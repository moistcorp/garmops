import { notFound } from "next/navigation";
import PortalPlaceholder from "@/components/portal/PortalPlaceholder";

const sections: Record<string, { title: string; description: string }> = {
  "": {
    title: "Workspace overview",
    description: "Track company orders, approvals, files, invoices, and production updates from one tenant-isolated workspace.",
  },
  orders: { title: "Orders", description: "Durable order history and production status will appear here." },
  designs: { title: "Designs", description: "Saved configurations, artwork versions, and approval history will appear here." },
  documents: { title: "Documents", description: "Private invoices, proofs, and order documents will appear here." },
  company: { title: "Company", description: "Organization details, GST information, members, and addresses belong here." },
  notifications: { title: "Notifications", description: "Account-specific production and approval notices will appear here." },
  "settings/profile": { title: "Profile", description: "Maintain your own permitted profile fields here." },
  "settings/security": { title: "Security", description: "Password and session security controls belong here." },
};

export default async function AccountSectionPage({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const path = (await params).section?.join("/") ?? "";
  const section = sections[path];
  if (!section) notFound();
  return (
    <PortalPlaceholder
      {...section}
      metrics={path === "" ? [
        { label: "Open orders", value: "—" },
        { label: "Approvals due", value: "—" },
        { label: "In production", value: "—" },
        { label: "Documents", value: "—" },
      ] : undefined}
    />
  );
}
