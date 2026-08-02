import { notFound, redirect } from "next/navigation";
import StaffOrderQueue from "@/components/staff/StaffOrderQueue";
import StaffOrderWorkspace from "@/components/staff/StaffOrderWorkspace";

export const dynamic = "force-dynamic";

export default async function StaffSectionPage({ params }: { params: Promise<{ section?: string[] }> }) {
  const parts = (await params).section ?? [];
  if (!parts.length) redirect("/staff/orders");
  if (parts.length === 1 && parts[0] === "orders") return <StaffOrderQueue />;
  if (parts.length === 2 && parts[0] === "orders") return <StaffOrderWorkspace orderNumber={parts[1]} />;
  notFound();
}
