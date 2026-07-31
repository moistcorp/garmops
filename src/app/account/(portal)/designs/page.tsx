import Link from "next/link";
import { Archive, ArrowRight, Cloud, Plus } from "lucide-react";

import PortalPlaceholder from "@/components/portal/PortalPlaceholder";
import BrowserDraftImporter from "@/components/account/BrowserDraftImporter";
import { requireOrganizationMember } from "@/lib/auth/guards";
import { isFeatureEnabled } from "@/lib/config/featureFlags";
import { listCloudDesigns } from "@/lib/designs/dal";
import { cloudDesignSnapshotSchema } from "@/lib/designs/schema";
import { getProduct } from "@/lib/configurator/products";
import type { ProductId } from "@/lib/configurator/pricing";

export const dynamic = "force-dynamic";

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

export default async function AccountDesignsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  if (!isFeatureEnabled("CLOUD_DESIGNS_ENABLED")) {
    return (
      <PortalPlaceholder
        title="Designs"
        description="Cloud design saving is currently disabled for this environment."
      />
    );
  }

  const includeArchived = (await searchParams).archived === "1";
  const { supabase } = await requireOrganizationMember("/account/designs");
  const { data, error } = await listCloudDesigns(
    supabase,
    includeArchived,
  );

  if (error) {
    return (
      <PortalPlaceholder
        title="Designs unavailable"
        description="Your saved designs could not be loaded. Try again shortly."
      />
    );
  }

  const designs = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#1D49B4]">
            Cloud workspace
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            Your designs
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-black/50">
            Resume current drafts across devices. Frozen versions remain
            separate from every order that uses them.
          </p>
        </div>
        <Link
          href="/configurator"
          className="inline-flex items-center justify-center gap-2 rounded-[4px] bg-[#1D49B4] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#173A91]"
        >
          <Plus size={16} aria-hidden="true" />
          Start a design
        </Link>
      </div>

      <div className="flex items-center gap-2 border-b border-black/8 pb-3">
        <Link
          href="/account/designs"
          className={`rounded-[4px] px-3 py-1.5 text-xs font-semibold ${
            !includeArchived
              ? "bg-[#1D49B4] text-white"
              : "bg-black/5 text-black/55 hover:bg-black/8"
          }`}
        >
          Active
        </Link>
        <Link
          href="/account/designs?archived=1"
          className={`rounded-[4px] px-3 py-1.5 text-xs font-semibold ${
            includeArchived
              ? "bg-[#1D49B4] text-white"
              : "bg-black/5 text-black/55 hover:bg-black/8"
          }`}
        >
          All designs
        </Link>
      </div>

      <BrowserDraftImporter />

      {designs.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {designs.map((design) => {
            const parsed = cloudDesignSnapshotSchema.safeParse(
              design.draft_snapshot,
            );
            const product = parsed.success
              ? getProduct(parsed.data.configId as ProductId)
              : undefined;
            return (
              <Link
                key={design.id}
                href={`/account/designs/${encodeURIComponent(design.id)}`}
                className="group techpack-surface flex min-h-52 flex-col rounded-[4px] border p-5 transition hover:-translate-y-0.5 hover:border-[#1D49B4]/30 hover: hover:/8"
              >
                <div className="flex items-start justify-between gap-4">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-[4px] px-2.5 py-1 text-[11px] font-semibold ${
                      design.status === "archived"
                        ? "bg-black/6 text-black/45"
                        : "bg-[#1D49B4]/12 text-[#1D49B4]"
                    }`}
                  >
                    {design.status === "archived" ? (
                      <Archive size={12} aria-hidden="true" />
                    ) : (
                      <Cloud size={12} aria-hidden="true" />
                    )}
                    {design.status}
                  </span>
                  <span className="text-xs text-black/35">
                    v{design.current_version}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-semibold tracking-tight">
                  {design.title}
                </h3>
                <p className="mt-1 text-sm text-black/45">
                  {product?.name ??
                    (parsed.success
                      ? parsed.data.configId.replaceAll("-", " ")
                      : "Legacy design")}
                </p>
                <div className="mt-auto flex items-end justify-between gap-4 pt-6">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-black/30">
                      Last saved
                    </p>
                    <p className="mt-1 text-xs text-black/50">
                      {formatTimestamp(design.last_saved_at)}
                    </p>
                  </div>
                  <ArrowRight
                    size={17}
                    className="text-black/25 transition group-hover:translate-x-0.5 group-hover:text-[#1D49B4]"
                    aria-hidden="true"
                  />
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="techpack-surface rounded-[4px] border border-dashed p-10 text-center">
          <Cloud size={28} className="mx-auto text-[#1D49B4]" aria-hidden="true" />
          <h3 className="mt-4 font-semibold">
            {includeArchived ? "No designs yet" : "No active cloud designs"}
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-black/45">
            Configure a product, then choose “Save to account” in the Studio.
            Your browser draft remains available until cloud save succeeds.
          </p>
        </div>
      )}
    </div>
  );
}
