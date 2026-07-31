"use client";

import { useEffect, useState } from "react";
import { CloudUpload, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  hasMeaningfulDraft,
  readBuildDraft,
  type BuildDraft,
} from "@/lib/configurator/buildDraft";
import {
  readDraft,
  totalUnits,
} from "@/components/configurator/cart/cartDraft";
import type { CartItem } from "@/components/configurator/cart/OrderReviewStep";
import type { NeckLabel } from "@/lib/configurator/types/configurator";
import {
  readCloudDesignLink,
  saveBuildDraftToCloud,
} from "@/lib/designs/client";

const BUILD_PREFIX = "mf_configurator_build:";
const CART_PREFIX = "mf_configurator_cart:";
const IMPORT_MARKER_PREFIX = "mf_configurator_cloud_imported:";

type ImportCandidate = {
  id: string;
  kind: "build" | "cart";
  configId: string;
  productName: string;
  draft: BuildDraft;
};

function cartItemDraft(item: CartItem): BuildDraft {
  const hasArtwork = Boolean(item.artwork.front || item.artwork.back);
  const hasNeckLabel = Boolean(
    item.neckLabel?.fileUrl || item.neckLabel?.fileId,
  );
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    colour: item.colour,
    artwork: item.artwork,
    neckLabel: (item.neckLabel ?? {}) as NeckLabel,
    steps: [
      {
        id: "garment-colour",
        title: "Garment Colour",
        summary: item.colour.name,
        confirmed: true,
      },
      {
        id: "artwork",
        title: "Artwork",
        summary: hasArtwork ? "Artwork added" : "No artwork added",
        confirmed: true,
        skipped: !hasArtwork,
      },
      {
        id: "neck-label",
        title: "Neck Label",
        summary: hasNeckLabel ? "Custom label added" : "Standard label",
        confirmed: true,
        skipped: !hasNeckLabel,
      },
    ],
    quantity: totalUnits(item.sizeQuantities),
  };
}

function scanBrowserDrafts(): ImportCandidate[] {
  const candidates: ImportCandidate[] = [];
  const keys = Array.from(
    { length: window.localStorage.length },
    (_, index) => window.localStorage.key(index),
  ).filter((key): key is string => Boolean(key));

  for (const key of keys) {
    if (key.startsWith(BUILD_PREFIX)) {
      const configId = key.slice(BUILD_PREFIX.length);
      const draft = readBuildDraft(configId);
      if (
        configId &&
        hasMeaningfulDraft(draft) &&
        draft &&
        !readCloudDesignLink(configId)
      ) {
        candidates.push({
          id: `build:${configId}`,
          kind: "build",
          configId,
          productName: configId.replaceAll("-", " "),
          draft,
        });
      }
      continue;
    }

    if (
      key.startsWith(CART_PREFIX) &&
      key !== `${CART_PREFIX}active` &&
      key !== `${CART_PREFIX}active_id`
    ) {
      const cartId = key.slice(CART_PREFIX.length);
      const cart = readDraft(cartId);
      cart.items.forEach((item) => {
        const marker = `${IMPORT_MARKER_PREFIX}${cartId}:${item.id}`;
        if (window.localStorage.getItem(marker)) return;
        candidates.push({
          id: `cart:${cartId}:${item.id}`,
          kind: "cart",
          configId: item.productId,
          productName: item.productName,
          draft: cartItemDraft(item),
        });
      });
    }
  }

  return candidates;
}

export default function BrowserDraftImporter() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setCandidates(scanBrowserDrafts());
      } catch {
        setCandidates([]);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function importDrafts() {
    setImporting(true);
    setMessage(null);
    let imported = 0;

    for (const candidate of candidates) {
      let result;
      try {
        result = await saveBuildDraftToCloud({
          configId: candidate.configId,
          productName: candidate.productName,
          draft: candidate.draft,
          createCopy: candidate.kind === "cart",
          operationKey: candidate.id,
        });
      } catch {
        continue;
      }
      if (!result.ok) continue;
      imported += 1;
      if (candidate.kind === "cart") {
        try {
          const [, cartId, itemId] = candidate.id.split(":");
          window.localStorage.setItem(
            `${IMPORT_MARKER_PREFIX}${cartId}:${itemId}`,
            result.link.designId,
          );
        } catch {
          // A repeat remains safe because the server-side import is replay-safe.
        }
      }
    }

    setImporting(false);
    setCandidates(scanBrowserDrafts());
    setMessage(
      imported
        ? `${imported} browser design${imported === 1 ? "" : "s"} imported. Local copies were retained as a fallback.`
        : "No browser designs could be imported. Your local drafts were not changed.",
    );
    router.refresh();
  }

  if (!candidates.length && !message) return null;

  return (
    <div className="rounded-[4px] border border-[#1D49B4]/20 bg-[#1D49B4]/8 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <CloudUpload
            size={18}
            className="mt-0.5 shrink-0 text-[#1D49B4]"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-semibold text-[#173A91]">
              {candidates.length
                ? `${candidates.length} design${candidates.length === 1 ? "" : "s"} found in this browser`
                : "Browser import complete"}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[#1D49B4]/75">
              {message ??
                "Import local Studio and cart drafts, including saved IndexedDB artwork, for cross-device access."}
            </p>
          </div>
        </div>
        {candidates.length ? (
          <button
            type="button"
            onClick={importDrafts}
            disabled={importing}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-[4px] bg-[#1D49B4] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#173A91] disabled:opacity-55"
          >
            {importing ? (
              <LoaderCircle
                size={16}
                className="animate-spin"
                aria-hidden="true"
              />
            ) : (
              <CloudUpload size={16} aria-hidden="true" />
            )}
            {importing ? "Importing…" : "Import browser drafts"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
