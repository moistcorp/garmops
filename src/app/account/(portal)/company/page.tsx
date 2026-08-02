import CompanyDetailsForms from "@/components/account/CompanyDetailsForms";
import PortalPlaceholder from "@/components/portal/PortalPlaceholder";
import TechpackPageHeader from "@/components/portal/TechpackPageHeader";
import { requireOrganizationMember } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function CompanyDetailsPage() {
  const { supabase, membership } = await requireOrganizationMember(
    "/account/company",
  );
  const [{ data: organization, error: organizationError }, { data: addresses, error: addressesError }] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("legal_name, display_name, gstin")
        .eq("id", membership.organization_id)
        .maybeSingle(),
      supabase
        .from("addresses")
        .select(
          "id, label, contact_name, phone, line1, line2, landmark, city, state, postal_code, is_default_billing, is_default_shipping",
        )
        .eq("organization_id", membership.organization_id)
        .order("is_default_shipping", { ascending: false })
        .order("created_at"),
    ]);

  if (organizationError || !organization || addressesError) {
    return (
      <PortalPlaceholder
        title="Company details unavailable"
        description="Your saved company information could not be loaded. Try again shortly."
      />
    );
  }

  const savedAddresses = addresses ?? [];
  const billingAddress = savedAddresses.find(
    (address) => address.is_default_billing,
  );
  const shippingAddresses = savedAddresses.filter(
    (address) => !address.is_default_billing || address.is_default_shipping,
  );

  return (
    <div className="space-y-7">
      <TechpackPageHeader
        eyebrow="Customer account"
        reference="Company record"
        title="Company details"
        description="Save company, GST and address information once so it can be reused for future orders and billing."
      />

      <CompanyDetailsForms
        companyName={organization.legal_name || organization.display_name}
        gstin={organization.gstin}
        billingAddress={billingAddress}
        shippingAddresses={shippingAddresses}
        canEditCompany={membership.role === "owner"}
        canEditAddresses={["owner", "buyer", "finance"].includes(
          membership.role,
        )}
      />
    </div>
  );
}
