import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Boxes,
  CheckCircle2,
  Clock3,
  FileStack,
  Palette,
  ShoppingBag,
} from "lucide-react";

import DesignActions from "@/components/account/DesignActions";
import PortalPlaceholder from "@/components/portal/PortalPlaceholder";
import { requireOrganizationMember } from "@/lib/auth/guards";
import { isFeatureEnabled } from "@/lib/config/featureFlags";
import type { ProductId } from "@/lib/configurator/pricing";
import { getProduct } from "@/lib/configurator/products";
import { getCloudDesign } from "@/lib/designs/dal";
import { cloudDesignSnapshotSchema } from "@/lib/designs/schema";

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

export default async function AccountDesignDetailPage({
  params,
}: {
  params: Promise<{ designId: string }>;
}) {
  if (!isFeatureEnabled("CLOUD_DESIGNS_ENABLED")) {
    return (
      <PortalPlaceholder
        title="Design unavailable"
        description="Cloud designs are disabled for this environment."
      />
    );
  }

  const { designId } = await params;
  const { supabase } = await requireOrganizationMember(
    `/account/designs/${designId}`,
  );
  const [projectResult, versionsResult, ordersResult] = await getCloudDesign(
    supabase,
    designId,
  );

  if (projectResult.error || !projectResult.data) notFound();
  if (versionsResult.error || ordersResult.error) {
    return (
      <PortalPlaceholder
        title="Design unavailable"
        description="The design history could not be loaded. Try again shortly."
      />
    );
  }

  const design = projectResult.data;
  const parsed = cloudDesignSnapshotSchema.safeParse(design.draft_snapshot);
  if (!parsed.success) {
    return (
      <div className="space-y-5">
        <Link
          href="/account/designs"
          className="inline-flex items-center gap-2 text-sm font-medium text-black/50 hover:text-[#315F66]"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Back to designs
        </Link>
        <PortalPlaceholder
          title={design.title}
          description="This legacy design uses an older configurator schema. Its immutable history is retained, but it must be duplicated or migrated before editing."
        />
      </div>
    );
  }

  const snapshot = parsed.data;
  const product = getProduct(snapshot.configId as ProductId);
  const configuration = snapshot.configuration;
  const artworkCount = [
    configuration.artwork.front,
    configuration.artwork.back,
  ].filter(Boolean).length;
  const versions = versionsResult.data ?? [];
  const orders = ordersResult.data ?? [];

  return (
    <div className="space-y-6">
      <Link
        href="/account/designs"
        className="inline-flex items-center gap-2 text-sm font-medium text-black/50 hover:text-[#315F66]"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Back to designs
      </Link>

      <div className="liquid-glass-surface rounded-3xl border p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#4F8B92]/12 px-2.5 py-1 text-[11px] font-semibold capitalize text-[#315F66]">
                {design.status}
              </span>
              <span className="rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-semibold text-black/45">
                Current version {design.current_version}
              </span>
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight">
              {design.title}
            </h2>
            <p className="mt-2 text-sm text-black/45">
              {product?.name ?? snapshot.configId.replaceAll("-", " ")}
            </p>
          </div>
          <div className="text-left text-xs text-black/40 lg:text-right">
            <p>Last saved {formatTimestamp(design.last_saved_at)}</p>
            <p className="mt-1">
              Revision {design.draft_revision} · schema {design.schema_version}
            </p>
          </div>
        </div>

        <div className="mt-7">
          <DesignActions
            designId={design.id}
            title={design.title}
            initialRevision={design.draft_revision}
            initialVersion={design.current_version}
            status={design.status}
            snapshot={snapshot}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Garment colour",
            value: configuration.colour.name,
            icon: Palette,
          },
          {
            label: "Quantity",
            value: `${configuration.quantity.toLocaleString("en-IN")} units`,
            icon: Boxes,
          },
          {
            label: "Artwork",
            value: artworkCount
              ? `${artworkCount} placement${artworkCount === 1 ? "" : "s"}`
              : "No artwork",
            icon: CheckCircle2,
          },
          {
            label: "Versions",
            value: String(versions.length),
            icon: FileStack,
          },
        ].map((metric) => (
          <div
            key={metric.label}
            className="liquid-glass-panel rounded-2xl border p-5"
          >
            <metric.icon
              size={17}
              className="text-[#4F8B92]"
              aria-hidden="true"
            />
            <p className="mt-4 text-[10px] uppercase tracking-widest text-black/35">
              {metric.label}
            </p>
            <p className="mt-2 font-semibold">{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="liquid-glass-surface rounded-3xl border p-6">
          <div className="flex items-center gap-2">
            <FileStack size={18} className="text-[#4F8B92]" aria-hidden="true" />
            <h3 className="font-semibold">Immutable version history</h3>
          </div>
          <div className="mt-5 space-y-3">
            {versions.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-black/7 bg-white/45 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold">
                    Version {entry.version_number}
                  </p>
                  <p className="mt-1 text-xs text-black/40">
                    {formatTimestamp(entry.created_at)}
                  </p>
                </div>
                {entry.version_number === design.current_version ? (
                  <span className="rounded-full bg-[#4F8B92]/12 px-2 py-1 text-[10px] font-semibold text-[#315F66]">
                    Current
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section className="liquid-glass-surface rounded-3xl border p-6">
          <div className="flex items-center gap-2">
            <ShoppingBag size={18} className="text-[#4F8B92]" aria-hidden="true" />
            <h3 className="font-semibold">Orders using this design</h3>
          </div>
          {orders.length ? (
            <div className="mt-5 space-y-3">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-2xl border border-black/7 bg-white/45 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold">
                      {order.order_number}
                    </p>
                    <span className="text-[10px] uppercase tracking-wider text-black/40">
                      {order.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-black/40">
                    Frozen version reference {order.design_version_id?.slice(0, 8)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-black/12 bg-white/30 p-6 text-center">
              <Clock3
                size={20}
                className="mx-auto text-black/25"
                aria-hidden="true"
              />
              <p className="mt-3 text-sm text-black/45">
                No submitted order uses this design yet.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
