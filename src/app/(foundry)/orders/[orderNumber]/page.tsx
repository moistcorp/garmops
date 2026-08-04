import StaffOrderWorkspace from "@/components/staff/StaffOrderWorkspace";
export default async function FoundryOrderPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  return <StaffOrderWorkspace orderNumber={(await params).orderNumber} />;
}
