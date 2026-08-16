import StaffOrderQueue from "@/components/staff/StaffOrderQueue";
export default async function FoundryOrdersPage({ searchParams }: { searchParams: Promise<{ search?: string; offset?: string }> }) {
  return <StaffOrderQueue searchParams={await searchParams} />;
}
