"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { GarmentView } from "@/lib/configurator/types/garment";
import type { GarmentColour, Artwork, NeckLabel } from "@/lib/configurator/types/configurator";
import GarmentPreview from "./GarmentPreview/GarmentPreview";
import {
  ConfiguratorSidebar,
  type AccordionStepId,
  type AccordionStepState,
  INITIAL_STEPS,
  DEFAULT_COLOUR,
} from "./ConfiguratorSidebar/ConfiguratorSidebar";
import { TECHNIQUE_LABELS } from "./ConfiguratorSidebar/ArtworkPanel/TechniqueSelect";
import { OrderBar } from "./OrderBar";
import { ConfiguratorHeader } from "./ConfiguratorHeader";
import { WhatsAppAssistantBar } from "./WhatsAppAssistantBar";
import { ArtworkPositionProvider } from "@/lib/configurator/ArtworkPositionContext";
import { getProduct } from "@/lib/configurator/products";
import { upsertConfiguredCartItem } from "./cart/cartDraft";

// ---------------------------------------------------------------------------
// Types (local to this file)
// ---------------------------------------------------------------------------

interface ConfigureClientProps {
  configId: string;
}

// Neck-label position values -> display labels used in the confirmed-step
// summary. Mirrors TECHNIQUE_LABELS' role for the artwork branch.
const POSITION_LABELS: Record<NeckLabel["position"], string> = {
  below_neck_tape: "Below neck tape",
  on_neck_tape: "On neck tape",
};

function getCtaLabel(openStep: AccordionStepId | null): string {
  switch (openStep) {
    case "garment-colour":
      return "Confirm Colour";
    case "artwork":
      return "Confirm Artwork";
    case "neck-label":
      return "Confirm Label";
    default:
      return "Add To Cart";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ConfigureClient({ configId }: ConfigureClientProps) {
  const router = useRouter();
  const product = getProduct(configId);
  const productId = product?.id ?? "tshirt-classic";
  const productName = product?.name ?? "Classic Tee";
  const [activeView, setActiveView] = useState<GarmentView>("front");
  const [expandedStepId, setExpandedStepId] = useState<AccordionStepId | null>("garment-colour");
  const [quantity, setQuantity] = useState<number>(50);

  // Lifted so the live preview (below) and the sidebar's Garment Colour step
  // read/write the same colour — was a disconnected placeholder pre-5B.
  const [colour, setColour] = useState<GarmentColour>(DEFAULT_COLOUR);
  const [steps, setSteps] = useState<AccordionStepState[]>(INITIAL_STEPS);

  // Lifted (6D-2) so the CTA/confirm flow can read per-side confirmed state
  // and build the summary string, mirroring the colour lift above.
  const [artwork, setArtwork] = useState<Artwork>({});

  // Lifted (7B) so the CTA/confirm flow can validate fileUrl/dimensions/
  // position and build the summary string, mirroring the artwork lift above.
  const [neckLabel, setNeckLabel] = useState<NeckLabel>({} as NeckLabel);

  function handleExpandedStepChange(next: AccordionStepId | null) {
    setExpandedStepId(next);
    if (next === "neck-label") {
      setActiveView("neck");
    }
  }

  function handleCtaClick() {
    if (expandedStepId === "garment-colour") {
      const confirmedColour: GarmentColour = { ...colour, confirmed: true };
      setColour(confirmedColour);

      const sectionLabel = confirmedColour.type === "signature" ? "Signature" : "Custom Dye";
      setSteps((prev) =>
        prev.map((step) =>
          step.id === "garment-colour"
            ? { ...step, confirmed: true, summary: `${sectionLabel} — ${confirmedColour.name}` }
            : step
        )
      );

      setExpandedStepId(null);
      setActiveView("front");
      return;
    }

    if (expandedStepId === "artwork") {
      const hasAnySide = Boolean(artwork.front || artwork.back);
      const allUploadedSidesConfirmed =
        (!artwork.front || artwork.front.confirmed) &&
        (!artwork.back || artwork.back.confirmed);

      // No precedent from 5B for a disabled/error CTA state, so an
      // incomplete artwork step (nothing uploaded, or a side still mid-edit)
      // is a no-op click rather than an error.
      if (!hasAnySide || !allUploadedSidesConfirmed) {
        return;
      }

      const summary = [
        artwork.front && `Front — ${TECHNIQUE_LABELS[artwork.front.technique]}`,
        artwork.back && `Back — ${TECHNIQUE_LABELS[artwork.back.technique]}`,
      ]
        .filter(Boolean)
        .join(", ");

      setSteps((prev) =>
        prev.map((step) =>
          step.id === "artwork" ? { ...step, confirmed: true, summary } : step
        )
      );

      setExpandedStepId(null);
      return;
    }

    if (expandedStepId === "neck-label") {
      const isReady = Boolean(
        neckLabel?.fileUrl && neckLabel?.dimensions && neckLabel?.position
      );

      // Same no-op-on-incomplete convention as the artwork branch above.
      if (!isReady) {
        return;
      }

      const confirmedNeckLabel: NeckLabel = { ...neckLabel, confirmed: true };
      setNeckLabel(confirmedNeckLabel);

      const dimensionsLabel = `${confirmedNeckLabel.dimensions.replace("x", "×")}mm`;
      const summary = `${dimensionsLabel} — ${POSITION_LABELS[confirmedNeckLabel.position]}`;

      setSteps((prev) =>
        prev.map((step) =>
          step.id === "neck-label" ? { ...step, confirmed: true, summary } : step
        )
      );

      setExpandedStepId(null);
      return;
    }

    upsertConfiguredCartItem(configId, {
      productId,
      productName,
      previewImage: product?.defaultImage ?? "/mock/tshirt-preview.png",
      colour,
      artwork,
      neckLabel: neckLabel?.fileUrl ? neckLabel : undefined,
      quantity,
    });
    router.push(`/configurator/cart/${encodeURIComponent(configId)}/review`);
  }

  return (
    <ArtworkPositionProvider activeView={activeView}>
      <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#F3F3F2] text-[#111111]">
        <ConfiguratorHeader configId={configId} productName={productName} />

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 px-4 pb-4 lg:grid-cols-[minmax(0,1fr)_410px] lg:px-5">
          <div className="relative flex min-h-0 min-w-0 flex-col items-center justify-center overflow-hidden rounded-[28px]">
            <GarmentPreview
              activeView={activeView}
              onViewChange={setActiveView}
              colourHex={colour.hex}
            />
            <div className="absolute bottom-4 right-4 hidden lg:block">
              <WhatsAppAssistantBar configId={configId} />
            </div>
          </div>

          <aside className="flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden">
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <ConfiguratorSidebar
                expandedStepId={expandedStepId}
                onExpandedStepChange={handleExpandedStepChange}
                selectedColour={colour}
                onColourChange={setColour}
                steps={steps}
                onStepsChange={setSteps}
                artwork={artwork}
                onArtworkChange={setArtwork}
                neckLabel={neckLabel}
                onNeckLabelChange={setNeckLabel}
              />
            </div>

            <div className="shrink-0">
              <OrderBar
                quantity={quantity}
                onQuantityChange={setQuantity}
                ctaLabel={getCtaLabel(expandedStepId)}
                onCtaClick={handleCtaClick}
                productId={productId}
                steps={steps}
                colour={colour}
                artwork={artwork}
                neckLabel={neckLabel}
              />
            </div>
          </aside>
        </div>
      </div>
    </ArtworkPositionProvider>
  );
}
