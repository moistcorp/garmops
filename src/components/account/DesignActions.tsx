"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  Copy,
  Download,
  ExternalLink,
  LoaderCircle,
  Milestone,
} from "lucide-react";

import { generateApprovalPdf } from "@/lib/configurator/approvalPdf";
import {
  getConfiguredPricingSummary,
  type ProductId,
} from "@/lib/configurator/pricing";
import { getProduct } from "@/lib/configurator/products";
import { RESERVATION_FEE } from "@/lib/configurator/reservation";
import { splitQuantityAcrossSizes } from "@/components/configurator/cart/cartDraft";
import {
  cloudSnapshotToBuildDraft,
  duplicateDesign,
} from "@/lib/designs/client";
import type { CloudDesignSnapshot } from "@/lib/designs/schema";

type PendingAction = "version" | "duplicate" | "archive" | "pdf" | null;

export default function DesignActions({
  designId,
  title,
  initialRevision,
  initialVersion,
  status,
  snapshot,
}: {
  designId: string;
  title: string;
  initialRevision: number;
  initialVersion: number;
  status: string;
  snapshot: CloudDesignSnapshot;
}) {
  const router = useRouter();
  const [revision, setRevision] = useState(initialRevision);
  const [version, setVersion] = useState(initialVersion);
  const [pending, setPending] = useState<PendingAction>(null);
  const [message, setMessage] = useState<string | null>(null);
  const editable = status === "draft";

  async function createVersion() {
    setPending("version");
    setMessage(null);
    const response = await fetch(
      `/api/designs/${encodeURIComponent(designId)}/versions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedRevision: revision }),
      },
    );
    if (response.ok) {
      const body = (await response.json()) as {
        version: { number: number; draftRevision: number };
      };
      setVersion(body.version.number);
      setRevision(body.version.draftRevision);
      setMessage(`Version ${body.version.number} created.`);
      router.refresh();
    } else if (response.status === 409) {
      setMessage("The design changed elsewhere. Refresh before creating a version.");
    } else {
      setMessage("A new version could not be created.");
    }
    setPending(null);
  }

  async function createDuplicate() {
    setPending("duplicate");
    setMessage(null);
    const result = await duplicateDesign(designId, `${title} copy`);
    if (result.ok) {
      router.push(`/account/designs/${encodeURIComponent(result.designId)}`);
      return;
    }
    setMessage("The design could not be duplicated.");
    setPending(null);
  }

  async function archiveDesign() {
    if (!window.confirm("Archive this design? Its versions and order links will be retained.")) {
      return;
    }
    setPending("archive");
    setMessage(null);
    const response = await fetch(
      `/api/designs/${encodeURIComponent(designId)}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedRevision: revision }),
      },
    );
    if (response.ok) {
      router.push("/account/designs");
      router.refresh();
      return;
    }
    setMessage(
      response.status === 409
        ? "The design changed elsewhere. Refresh before archiving."
        : "The design could not be archived.",
    );
    setPending(null);
  }

  async function downloadPdf() {
    setPending("pdf");
    setMessage(null);
    try {
      const draft = await cloudSnapshotToBuildDraft(snapshot);
      const productId = snapshot.configId as ProductId;
      const product = getProduct(productId);
      const pricing = getConfiguredPricingSummary(
        productId,
        draft.colour,
        draft.artwork,
        draft.neckLabel?.fileUrl || draft.neckLabel?.fileId
          ? draft.neckLabel
          : undefined,
        draft.quantity,
      );
      await generateApprovalPdf({
        projectReference: designId.slice(0, 8).toUpperCase(),
        documentTitle: "Merch Design Summary",
        items: [
          {
            id: designId,
            productName: product?.name ?? title,
            previewImage:
              product?.defaultImage ?? "/flatlays/regulartee.png",
            colour: draft.colour,
            artwork: draft.artwork,
            neckLabel:
              draft.neckLabel?.fileUrl || draft.neckLabel?.fileId
                ? draft.neckLabel
                : undefined,
            sizeQuantities: splitQuantityAcrossSizes(
              draft.quantity,
              product?.sizes ?? ["XS", "S", "M", "L", "XL", "XXL"],
            ),
            unitPrice: pricing.discountedUnitPrice,
          },
        ],
        totals: {
          subtotal: pricing.lineSubtotal,
          volumeDiscount: pricing.discountAmount,
          gst: pricing.gst,
          total: pricing.total,
          reservationFee: RESERVATION_FEE,
          balanceDue: Math.max(0, pricing.total - RESERVATION_FEE),
        },
        filename: `Garmops-Design-${designId.slice(0, 8)}-v${version}.pdf`,
      });
      setMessage(`Version ${version} design PDF downloaded.`);
    } catch {
      setMessage("The design PDF could not be generated.");
    }
    setPending(null);
  }

  const actionClass =
    "inline-flex items-center justify-center gap-2 rounded-[4px] border border-black/10 bg-white px-3.5 py-2.5 text-sm font-semibold text-black/70 transition hover:border-[#1D49B4]/35 hover:text-[#1D49B4] disabled:cursor-not-allowed disabled:opacity-45";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            router.push(
              `/configurator/build/${encodeURIComponent(snapshot.configId)}?designId=${encodeURIComponent(designId)}`,
            )
          }
          className="inline-flex items-center justify-center gap-2 rounded-[4px] bg-[#1D49B4] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#173A91]"
        >
          <ExternalLink size={16} aria-hidden="true" />
          Resume in Studio
        </button>
        <button
          type="button"
          onClick={downloadPdf}
          disabled={pending !== null}
          className={actionClass}
        >
          {pending === "pdf" ? (
            <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
          ) : (
            <Download size={16} aria-hidden="true" />
          )}
          Download PDF
        </button>
        <button
          type="button"
          onClick={createVersion}
          disabled={!editable || pending !== null}
          className={actionClass}
        >
          {pending === "version" ? (
            <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
          ) : (
            <Milestone size={16} aria-hidden="true" />
          )}
          Create version
        </button>
        <button
          type="button"
          onClick={createDuplicate}
          disabled={pending !== null}
          className={actionClass}
        >
          {pending === "duplicate" ? (
            <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
          ) : (
            <Copy size={16} aria-hidden="true" />
          )}
          Duplicate
        </button>
        <button
          type="button"
          onClick={archiveDesign}
          disabled={!editable || pending !== null}
          className={actionClass}
        >
          {pending === "archive" ? (
            <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
          ) : (
            <Archive size={16} aria-hidden="true" />
          )}
          Archive
        </button>
      </div>
      {message ? (
        <p role="status" className="text-xs text-black/50">
          {message}
        </p>
      ) : null}
    </div>
  );
}
