import { redirect } from "next/navigation";
export default async function LegacyStaffSection({ params }: { params: Promise<{ section?: string[] }> }) {
  const section = (await params).section ?? [];
  if (section[0] === "orders" && section[1]) redirect(`/orders/${section[1]}`);
  redirect("/orders");
}
