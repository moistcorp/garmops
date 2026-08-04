import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Palette, Plus } from "lucide-react";

import BrowserDraftImporter from "@/components/account/BrowserDraftImporter";
import PortalPlaceholder from "@/components/portal/PortalPlaceholder";
import TechpackPageHeader from "@/components/portal/TechpackPageHeader";
import { getProduct } from "@/lib/configurator/products";
import { isFeatureEnabled } from "@/lib/config/featureFlags";
import { listCloudDesigns } from "@/lib/designs/dal";
import {
  cloudDesignSnapshotSchema,
  type CloudDesignSnapshot,
} from "@/lib/designs/schema";
import { requireCustomer } from "@/lib/auth/guards";
import { formatOrderTimestamp } from "@/lib/orders/format";

export const dynamic = "force-dynamic";

type DesignEntry = {
  design: NonNullable<Awaited<ReturnType<typeof listCloudDesigns>>["data"]>[number];
  snapshot: CloudDesignSnapshot;
};

export default async function SavedDesignsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>;
}) {
  const { filter = "active", q = "" } = await searchParams;
  const { supabase, user } = await requireCustomer("/account/designs");

  if (!isFeatureEnabled("CLOUD_DESIGNS_ENABLED")) {
    return (
      <PortalPlaceholder
        title="Saved designs are not available"
        description="Start a design from the configurator and save it to your account when this feature is enabled."
      />
    );
  }

  const { data, error } = await listCloudDesigns(
    supabase,
    user.id,
    filter === "archived",
  );
  if (error) {
    return (
      <PortalPlaceholder
        title="Saved designs unavailable"
        description="We couldn’t load your saved designs. Refresh the page or try again shortly."
      />
    );
  }

  const query = q.trim().toLowerCase();
  const designs: DesignEntry[] = (data ?? [])
    .filter((design) =>
      filter === "archived"
        ? design.status === "archived"
        : design.status !== "archived",
    )
    .map((design) => {
      const snapshot = cloudDesignSnapshotSchema.safeParse(design.draft_snapshot);
      return snapshot.success ? { design, snapshot: snapshot.data } : null;
    })
    .filter((entry): entry is DesignEntry => entry !== null)
    .filter(({ design, snapshot }) => {
      const product = getProduct(snapshot.configId);
      return (
        !query ||
        `${design.title} ${product?.name ?? snapshot.configId}`
          .toLowerCase()
          .includes(query)
      );
    });

  return (
    <div className="space-y-7">
      <TechpackPageHeader
        eyebrow="Customer account"
        reference="Design register"
        title="Saved designs"
        description="Open a saved production specification to review it or continue editing."
        actions={
          <Link
            href="/configurator"
            className="inline-flex items-center justify-center gap-2 rounded-[4px] bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-accent-dark)]"
          >
            <Plus size={16} aria-hidden="true" /> Start a new design
          </Link>
        }
      />

      <BrowserDraftImporter />

      <div className="flex flex-col gap-3 border-b border-[var(--color-rule)] pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          {[
            { href: "/account/designs?filter=active", value: "active", label: "Active" },
            { href: "/account/designs?filter=archived", value: "archived", label: "Archived" },
          ].map((entry) => {
            const active = entry.value === "archived"
              ? filter === "archived"
              : filter !== "archived";
            return (
              <Link
                key={entry.value}
                href={entry.href}
                className={`techpack-stamp ${active ? "techpack-selected" : ""}`}
              >
                {entry.label}
              </Link>
            );
          })}
        </div>
        <form className="flex gap-2" action="/account/designs">
          <input type="hidden" name="filter" value={filter} />
          <label className="sr-only" htmlFor="design-search">Search saved designs</label>
          <input
            id="design-search"
            name="q"
            defaultValue={q}
            placeholder="Search designs"
            className="techpack-control w-full rounded-[4px] border px-3 py-2 text-sm outline-none focus:!border-[var(--color-accent)] sm:w-56"
          />
          <button className="techpack-control rounded-[4px] border px-3 py-2 text-sm font-semibold">
            Search
          </button>
        </form>
      </div>

      {designs.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {designs.map(({ design, snapshot }) => {
            const product = getProduct(snapshot.configId);
            const configuration = snapshot.configuration;
            const artworkSides = [
              configuration.artwork.front ? "Front" : null,
              configuration.artwork.back ? "Back" : null,
            ]
              .filter(Boolean)
              .join(" + ");
            return (
              <article
                key={design.id}
                className="techpack-surface grid gap-4 rounded-[4px] border p-4 sm:grid-cols-[150px_minmax(0,1fr)] sm:p-5"
              >
                <Link
                  href={`/account/designs/${encodeURIComponent(design.id)}`}
                  className="group relative flex min-h-40 items-center justify-center overflow-hidden rounded-[4px] border border-[var(--color-rule)] bg-[var(--color-cream-soft)]"
                  aria-label={`View ${design.title}`}
                >
                  <Image
                    src={product?.defaultImage ?? "/flatlays/regulartee.png"}
                    alt={`${product?.name ?? "Garment"} in ${configuration.colour.name}`}
                    fill
                    sizes="(max-width: 640px) 100vw, 150px"
                    className="object-contain p-4 transition group-hover:scale-105"
                  />
                </Link>
                <div className="flex min-w-0 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="truncate text-lg font-semibold">{design.title}</h2>
                    <span className="techpack-stamp" data-tone="accent">{design.status}</span>
                  </div>
                  <p className="mt-1 truncate text-sm text-black/55">
                    {product?.name ?? snapshot.configId}
                  </p>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="font-mono text-[9px] uppercase tracking-[0.08em] text-black/40">Quantity</dt>
                      <dd className="mt-1 font-medium">{configuration.quantity.toLocaleString("en-IN")} pcs</dd>
                    </div>
                    <div>
                      <dt className="font-mono text-[9px] uppercase tracking-[0.08em] text-black/40">Customisation</dt>
                      <dd className="mt-1 font-medium">{artworkSides || "No artwork"}{configuration.neckLabel ? " · Label" : ""}</dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-xs text-black/45">
                    Last saved {formatOrderTimestamp(design.last_saved_at)}
                  </p>
                  <Link
                    href={`/account/designs/${encodeURIComponent(design.id)}`}
                    className="mt-3 inline-flex items-center gap-1 border-t border-[var(--color-rule)] pt-3 text-sm font-semibold text-[var(--color-accent)] hover:underline"
                  >
                    View specification <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="techpack-surface rounded-[4px] border border-dashed p-10 text-center">
          <Palette size={30} className="mx-auto text-[var(--color-accent)]" aria-hidden="true" />
          <h2 className="mt-4 text-xl font-semibold">No saved designs yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-black/50">
            Save a design from the configurator to continue it later.
          </p>
          <Link
            href="/configurator"
            className="mt-5 inline-flex rounded-[4px] bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Start designing
          </Link>
        </div>
      )}
    </div>
  );
}
