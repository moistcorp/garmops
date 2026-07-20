"use client";

import { useEffect, useRef, useState } from "react";
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
import {
  readBuildDraft,
  writeBuildDraft,
  clearBuildDraft,
  hasMeaningfulDraft,
} from "@/lib/configurator/buildDraft";

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
  const [expandedStepId, setExpandedStepId] = useState<AccordionStepId | null>(null);
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

  // Autosave: whether a saved draft was restored on load (drives the small
  // "Draft restored" notice below), and a ref so the debounced-write effect
  // doesn't fire on the very first render before restoration has happened.
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftJustSaved, setDraftJustSaved] = useState(false);
  const hasHydrated = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Validation feedback for a failed "Confirm"/CTA click on the currently
  // expanded step. Previously an incomplete step's CTA click was a silent
  // no-op (see handleCtaClick below) — this surfaces what's missing inline
  // on the step itself, plus a brief flash near the CTA button in OrderBar.
  const [stepError, setStepError] = useState<{ id: AccordionStepId; message: string } | null>(
    null
  );
  // Bumped on every failed CTA click so OrderBar can re-trigger its
  // attention flash even when the error message text hasn't changed.
  const [ctaErrorNonce, setCtaErrorNonce] = useState(0);

  // Restore any in-progress draft for this configId on mount. Runs once —
  // deliberately not re-run on configId change within this component's
  // lifetime, since configId is a route param and the component remounts
  // when it changes.
  useEffect(() => {
    const draft = readBuildDraft(configId);
    if (hasMeaningfulDraft(draft) && draft) {
      // Restoring a localStorage draft is a one-time sync from an external
      // system (browser storage) on mount, not state derived from props —
      // the usual reason to avoid setState-in-effect doesn't apply here.
      /* eslint-disable react-hooks/set-state-in-effect */
      setColour(draft.colour);
      setArtwork(draft.artwork);
      setNeckLabel(draft.neckLabel);
      setSteps(draft.steps);
      setQuantity(draft.quantity);
      setDraftRestored(true);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
    hasHydrated.current = true;
  }, [configId]);

  // Debounced autosave — writes the in-progress build to localStorage
  // shortly after any change, so a refresh or closed tab doesn't lose
  // uploaded artwork or unconfirmed selections. Only the final "Add To Cart"
  // click previously persisted anything; every step in between was lost on
  // reload.
  useEffect(() => {
    if (!hasHydrated.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      writeBuildDraft(configId, { colour, artwork, neckLabel, steps, quantity });
      setDraftJustSaved(true);
      setTimeout(() => setDraftJustSaved(false), 1500);
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [configId, colour, artwork, neckLabel, steps, quantity]);

  function handleExpandedStepChange(next: AccordionStepId | null) {
    setExpandedStepId(next);
    setStepError(null);
    if (next === "neck-label") {
      setActiveView("neck");
    }
  }

  // Clears any validation message for the step the user is actively editing
  // as soon as they make a change — the error shouldn't linger once they've
  // started addressing it, even before they click Confirm again.
  useEffect(() => {
    if (!stepError) return;
    const shouldClear =
      (stepError.id === "artwork" && expandedStepId === "artwork") ||
      (stepError.id === "neck-label" && expandedStepId === "neck-label");
    if (!shouldClear) return;
    const timer = setTimeout(() => setStepError(null), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artwork, neckLabel]);

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

      setStepError(null);
      setExpandedStepId(null);
      setActiveView("front");
      return;
    }

    if (expandedStepId === "artwork") {
      const hasAnySide = Boolean(artwork.front || artwork.back);
      const allUploadedSidesConfirmed =
        (!artwork.front || artwork.front.confirmed) &&
        (!artwork.back || artwork.back.confirmed);

      // Was a silent no-op click on an incomplete step. Now surfaces exactly
      // what's missing — nothing uploaded vs. a side uploaded but not yet
      // confirmed with its own "Confirm Front/Back" button — so the CTA
      // click always gives the customer feedback.
      if (!hasAnySide) {
        setStepError({
          id: "artwork",
          message: "Upload artwork for at least one side before confirming.",
        });
        setCtaErrorNonce((n) => n + 1);
        return;
      }
      if (!allUploadedSidesConfirmed) {
        setStepError({
          id: "artwork",
          message:
            "Finish confirming artwork on each side you've added — use the Confirm button under that side.",
        });
        setCtaErrorNonce((n) => n + 1);
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

      setStepError(null);
      setExpandedStepId(null);
      return;
    }

    if (expandedStepId === "neck-label") {
      const isReady = Boolean(
        neckLabel?.fileUrl && neckLabel?.dimensions && neckLabel?.position
      );

      if (!isReady) {
        const message = !neckLabel?.fileUrl
          ? "Upload your neck label artwork (or try the sample) before confirming."
          : "Choose a label size before confirming.";
        setStepError({ id: "neck-label", message });
        setCtaErrorNonce((n) => n + 1);
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

      setStepError(null);
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
      rushDelivery: false,
    });
    // The in-progress build draft's job is done now that it's been handed
    // off to the cart draft — clear it so a stale autosave doesn't resurface
    // if the customer starts a fresh build under the same configId later.
    clearBuildDraft(configId);
    router.push(`/configurator/cart/${encodeURIComponent(configId)}/review`);
  }

  return (
    <ArtworkPositionProvider activeView={activeView}>
      <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-white text-[#111111]">
        <ConfiguratorHeader configId={configId} productName={productName} />

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 px-4 pb-4 lg:grid-cols-[360px_minmax(0,1fr)_310px] lg:px-5">
          <aside className="order-2 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-[#E5E5E5] bg-white lg:order-1">
            <div className="border-b border-[#E5E5E5] px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#111111]/45">
                  Build Steps
                </p>
                <span
                  className={`text-[10px] font-medium uppercase tracking-wide text-[#111111]/35 transition-opacity ${
                    draftJustSaved ? "opacity-100" : "opacity-0"
                  }`}
                  aria-live="polite"
                >
                  Draft saved
                </span>
              </div>
              <h1 className="mt-1 text-lg font-semibold text-[#111111]">{productName}</h1>
              {draftRestored && (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-[#F7F7F7] px-2.5 py-1.5 text-xs text-[#111111]/65">
                  <span>Restored your unsaved progress.</span>
                  <button
                    type="button"
                    onClick={() => setDraftRestored(false)}
                    aria-label="Dismiss"
                    className="shrink-0 font-semibold text-[#111111]/50 hover:text-[#111111]"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3">
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
                activeView={activeView}
                onViewChange={setActiveView}
                stepError={stepError}
              />
            </div>
          </aside>

          <main className="order-1 relative flex min-h-0 min-w-0 flex-col items-center justify-center overflow-hidden rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] lg:order-2">
            <GarmentPreview
              activeView={activeView}
              onViewChange={setActiveView}
              colourHex={colour.hex}
              productId={productId}
              artwork={artwork}
              neckLabel={neckLabel}
            />
            <div className="absolute bottom-4 right-4 hidden lg:block">
              <WhatsAppAssistantBar configId={configId} />
            </div>
          </main>

          <aside className="order-3 flex min-h-0 min-w-0 flex-col justify-between gap-3 overflow-hidden">
            <div className="rounded-lg border border-[#E5E5E5] bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#111111]/45">
                Studio Summary
              </p>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-[#111111]/55">Colour</span>
                  <span className="text-right font-medium">{colour.name}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-[#111111]/55">Artwork</span>
                  <span className="text-right font-medium">
                    {[artwork.front?.confirmed && "Front", artwork.back?.confirmed && "Back"]
                      .filter(Boolean)
                      .join(" + ") || "Not added"}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-[#111111]/55">Neck label</span>
                  <span className="text-right font-medium">
                    {neckLabel?.confirmed ? "Added" : "Not added"}
                  </span>
                </div>
              </div>
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
                ctaErrorMessage={
                  stepError && stepError.id === expandedStepId ? stepError.message : null
                }
                ctaErrorNonce={ctaErrorNonce}
              />
            </div>
          </aside>
        </div>
      </div>
    </ArtworkPositionProvider>
  );
}
