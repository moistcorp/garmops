"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle } from "lucide-react";
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
import { computeConfiguredUnitCost, OrderBar } from "./OrderBar";
import { ConfiguratorHeader } from "./ConfiguratorHeader";
import { WhatsAppAssistantBar } from "./WhatsAppAssistantBar";
import { ArtworkPositionProvider } from "@/lib/configurator/ArtworkPositionContext";
import { getProduct } from "@/lib/configurator/products";
import { formatInr, getBasePrice } from "@/lib/configurator/pricing";
import { CUSTOM_DYE_MOQ_UNITS } from "@/lib/configurator/colours";
import {
  readDraft,
  totalUnits,
  upsertConfiguredCartItem,
  type ConfiguredCartItemInput,
} from "./cart/cartDraft";
import {
  readBuildDraft,
  writeBuildDraft,
  clearBuildDraft,
  hasMeaningfulDraft,
} from "@/lib/configurator/buildDraft";
import {
  restoreConfigurationUploads,
  revokeArtworkObjectUrls,
  revokeNeckLabelObjectUrl,
} from "@/lib/configurator/objectUrls";

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

const FALLBACK_PRODUCT_ID = "regular-fit-tee-200gsm";
const VECTOR_REQUIRED_TECHNIQUES = new Set([
  "screen_print",
  "puff_print",
  "embroidery",
  "reflective_heat_transfer",
]);

function safeQuantity(value: unknown, minimum = 50): number {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.max(minimum, Math.floor(parsed))
    : minimum;
}

function stepsForConfiguration(
  colour: GarmentColour,
  artwork: Artwork,
  neckLabel?: NeckLabel
): AccordionStepState[] {
  const colourSummary = colour.name
    ? `${colour.type === "signature" ? "Signature" : "Custom Dye"} — ${colour.name}`
    : null;
  const artworkSummary = [
    artwork.front?.technique &&
      `Front — ${TECHNIQUE_LABELS[artwork.front.technique]}`,
    artwork.back?.technique &&
      `Back — ${TECHNIQUE_LABELS[artwork.back.technique]}`,
  ]
    .filter(Boolean)
    .join(", ");
  const labelSummary =
    neckLabel?.dimensions && neckLabel.position
      ? `${neckLabel.dimensions.replace("x", "×")}mm — ${POSITION_LABELS[neckLabel.position]}`
      : null;

  return INITIAL_STEPS.map((step) => {
    if (step.id === "garment-colour") {
      return { ...step, confirmed: colour.confirmed, summary: colourSummary };
    }
    if (step.id === "artwork") {
      const confirmed = Boolean(
        (artwork.front || artwork.back) &&
          (!artwork.front || artwork.front.confirmed) &&
          (!artwork.back || artwork.back.confirmed)
      );
      return { ...step, confirmed, summary: artworkSummary || null };
    }
    return {
      ...step,
      confirmed: neckLabel?.confirmed === true,
      summary: labelSummary,
    };
  });
}

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

function getStepTitle(stepId: AccordionStepId, isToteProduct = false): string {
  switch (stepId) {
    case "garment-colour":
      return "Garment Colour";
    case "artwork":
      return "Artwork";
    case "neck-label":
      return isToteProduct ? "Bag Label" : "Neck Label";
  }
}

function getBuildProgress(steps: AccordionStepState[]) {
  const nextStepIndex = steps.findIndex((step) => !step.confirmed);
  const currentStepIndex = nextStepIndex === -1 ? steps.length - 1 : nextStepIndex;
  const stepLabel = steps[currentStepIndex]?.title.replace("Garment ", "") ?? "Colour";

  return {
    current: currentStepIndex + 1,
    total: steps.length,
    label: stepLabel,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ConfigureClient({ configId }: ConfigureClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const product = getProduct(configId);
  const productId = product?.id ?? FALLBACK_PRODUCT_ID;
  const productName = product?.name ?? "Classic Tee";
  const editCartId = searchParams.get("cartId");
  const editItemId = searchParams.get("itemId");
  const isToteProduct = productId.includes("tote");
  let unitBasePrice: number | undefined;
  try {
    unitBasePrice = getBasePrice(productId);
  } catch {
    unitBasePrice = undefined;
  }
  const [activeView, setActiveView] = useState<GarmentView>("front");
  const [expandedStepId, setExpandedStepId] = useState<AccordionStepId | null>(null);
  const [pendingStepId, setPendingStepId] = useState<AccordionStepId | null>(null);
  const [unsavedStepId, setUnsavedStepId] = useState<AccordionStepId | null>(null);
  const [quantity, setQuantity] = useState<number>(50);
  const [ctaErrorMessage, setCtaErrorMessage] = useState<string | null>(null);
  const [ctaErrorNonce, setCtaErrorNonce] = useState(0);

  // Lifted so the live preview (below) and the sidebar's Garment Colour step
  // read/write the same colour — was a disconnected placeholder pre-5B.
  const [colour, setColour] = useState<GarmentColour>(DEFAULT_COLOUR);
  const [steps, setSteps] = useState<AccordionStepState[]>(INITIAL_STEPS);
  const buildProgress = getBuildProgress(steps);

  // Lifted (6D-2) so the CTA/confirm flow can read per-side confirmed state
  // and build the summary string, mirroring the colour lift above.
  const [artwork, setArtwork] = useState<Artwork>({});

  // Lifted (7B) so the CTA/confirm flow can validate fileUrl/dimensions/
  // position and build the summary string, mirroring the artwork lift above.
  const [neckLabel, setNeckLabel] = useState<NeckLabel>({} as NeckLabel);
  const configuredUnitCost = computeConfiguredUnitCost(
    productId,
    colour,
    artwork,
    neckLabel,
    quantity
  );
  const configuredOrderTotal = configuredUnitCost * quantity;
  const minimumQuantity = colour.type === "custom_dye" ? CUSTOM_DYE_MOQ_UNITS : 50;

  // Autosave: whether a saved draft was restored on load (drives the small
  // "Draft restored" notice below), and a ref so the debounced-write effect
  // doesn't fire on the very first render before restoration has happened.
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftJustSaved, setDraftJustSaved] = useState(false);
  const hasHydrated = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore any in-progress draft for this configId on mount. Runs once —
  // deliberately not re-run on configId change within this component's
  // lifetime, since configId is a route param and the component remounts
  // when it changes.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const applyRestoredConfiguration = async (
        restoredColour: GarmentColour,
        restoredArtwork: Artwork,
        restoredNeckLabel: NeckLabel | undefined,
        restoredQuantity: unknown
      ) => {
        const uploads = await restoreConfigurationUploads(
          restoredArtwork,
          restoredNeckLabel
        );
        if (cancelled) return;
        setColour(restoredColour);
        setArtwork(uploads.artwork);
        setNeckLabel((uploads.neckLabel ?? {}) as NeckLabel);
        setSteps(
          stepsForConfiguration(
            restoredColour,
            uploads.artwork,
            uploads.neckLabel
          )
        );
        setQuantity(
          safeQuantity(
            restoredQuantity,
            restoredColour.type === "custom_dye" ? CUSTOM_DYE_MOQ_UNITS : 50
          )
        );
        setDraftRestored(true);
      };

      const sharedDesign = searchParams.get("design");
      if (sharedDesign) {
        try {
          const parsed = JSON.parse(
            decodeURIComponent(escape(atob(sharedDesign)))
          ) as Partial<{
            colour: GarmentColour;
            artwork: Artwork;
            neckLabel: NeckLabel;
            quantity: unknown;
          }>;
          if (
            parsed.colour &&
            (parsed.colour.type === "signature" ||
              parsed.colour.type === "custom_dye") &&
            parsed.artwork &&
            typeof parsed.artwork === "object"
          ) {
            await applyRestoredConfiguration(
              parsed.colour,
              parsed.artwork,
              parsed.neckLabel,
              parsed.quantity
            );
            hasHydrated.current = true;
            return;
          }
        } catch {
          // Ignore malformed shared-design payloads and fall back to local state.
        }
      }

      if (editCartId && editItemId) {
        const item = readDraft(editCartId).items.find(
          (candidate) => candidate.id === editItemId
        );
        if (item && item.productId === productId) {
          await applyRestoredConfiguration(
            item.colour,
            item.artwork,
            item.neckLabel,
            totalUnits(item.sizeQuantities)
          );
          hasHydrated.current = true;
          return;
        }
      }

      const draft = readBuildDraft(configId);
      if (hasMeaningfulDraft(draft) && draft) {
        await applyRestoredConfiguration(
          draft.colour,
          draft.artwork,
          draft.neckLabel,
          draft.quantity
        );
      }
      hasHydrated.current = true;
    })();

    return () => {
      cancelled = true;
    };
  }, [configId, editCartId, editItemId, productId, searchParams]);

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

  function hasUnconfirmedChanges(stepId: AccordionStepId | null): boolean {
    if (!stepId) return false;
    if (stepId === "garment-colour") return !colour.confirmed;
    if (stepId === "artwork") {
      return Boolean(
        (artwork.front && !artwork.front.confirmed) ||
          (artwork.back && !artwork.back.confirmed)
      );
    }
    return Boolean(neckLabel?.fileUrl && !neckLabel.confirmed);
  }

  function resetStepDraft(stepId: AccordionStepId) {
    if (stepId === "garment-colour") {
      setColour(DEFAULT_COLOUR);
    }
    if (stepId === "artwork") {
      revokeArtworkObjectUrls(artwork);
      setArtwork({});
    }
    if (stepId === "neck-label") {
      revokeNeckLabelObjectUrl(neckLabel);
      setNeckLabel({} as NeckLabel);
    }
    setSteps((prev) =>
      prev.map((step) =>
        step.id === stepId ? { ...step, confirmed: false, summary: null } : step
      )
    );
  }

  function showCtaError(message: string) {
    setCtaErrorMessage(message);
    setCtaErrorNonce((prev) => prev + 1);
  }

  function setSafeQuantity(next: number) {
    setQuantity(safeQuantity(next, minimumQuantity));
  }

  function applyExpandedStepChange(next: AccordionStepId | null) {
    const wasNeckLabel = expandedStepId === "neck-label";
    setExpandedStepId(next);
    if (next === "neck-label") {
      setActiveView("neck");
    } else if (wasNeckLabel) {
      // Neck Label just closed (collapsed, or another step opened instead) —
      // don't leave the live preview stuck on the neck crop.
      setActiveView("front");
    }
  }

  function handleExpandedStepChange(next: AccordionStepId | null) {
    if (next !== expandedStepId && hasUnconfirmedChanges(expandedStepId)) {
      setPendingStepId(next);
      setUnsavedStepId(expandedStepId);
      return;
    }
    applyExpandedStepChange(next);
  }

  function discardUnsavedChanges() {
    if (unsavedStepId) {
      resetStepDraft(unsavedStepId);
    }
    applyExpandedStepChange(pendingStepId);
    setPendingStepId(null);
    setUnsavedStepId(null);
  }

  function keepEditing() {
    setPendingStepId(null);
    setUnsavedStepId(null);
  }

  function handleCtaClick() {
    setCtaErrorMessage(null);

    if (expandedStepId === "garment-colour") {
      if (!colour.name) {
        showCtaError("Choose a garment colour before confirming.");
        return;
      }
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

      setActiveView("front");
      // Auto-advance: open Artwork next instead of leaving the customer to
      // reopen it manually.
      applyExpandedStepChange("artwork");
      return;
    }

    if (expandedStepId === "artwork") {
      const hasAnySide = Boolean(artwork.front || artwork.back);
      const allUploadedSidesReady =
        (!artwork.front || Boolean(artwork.front.technique)) &&
        (!artwork.back || Boolean(artwork.back.technique));
      const sideNeedingVector = (["front", "back"] as const).find((side) => {
        const candidate = artwork[side];
        return Boolean(
          candidate?.technique &&
            VECTOR_REQUIRED_TECHNIQUES.has(candidate.technique) &&
            !candidate.vectorized
        );
      });

      if (!hasAnySide || !allUploadedSidesReady || sideNeedingVector) {
        showCtaError(
          !hasAnySide
            ? "Upload artwork for at least one side."
            : sideNeedingVector
              ? `Upload vector artwork for the ${sideNeedingVector} side before confirming.`
            : "Choose a technique for each uploaded artwork."
        );
        return;
      }

      const confirmedArtwork: Artwork = {
        front: artwork.front ? { ...artwork.front, confirmed: true } : undefined,
        back: artwork.back ? { ...artwork.back, confirmed: true } : undefined,
      };
      setArtwork(confirmedArtwork);

      const summary = [
        confirmedArtwork.front?.technique &&
          `Front — ${TECHNIQUE_LABELS[confirmedArtwork.front.technique]}`,
        confirmedArtwork.back?.technique &&
          `Back — ${TECHNIQUE_LABELS[confirmedArtwork.back.technique]}`,
      ]
        .filter(Boolean)
        .join(", ");

      setSteps((prev) =>
        prev.map((step) =>
          step.id === "artwork" ? { ...step, confirmed: true, summary } : step
        )
      );

      // Auto-advance: open Neck Label next.
      applyExpandedStepChange("neck-label");
      return;
    }

    if (expandedStepId === "neck-label") {
      const isReady = Boolean(
        neckLabel?.fileUrl &&
          neckLabel?.dimensions &&
          neckLabel?.position &&
          (neckLabel.position !== "below_neck_tape" || neckLabel.stitch)
      );

      if (!isReady) {
        showCtaError(
          "Upload label artwork and choose its dimensions, position, and stitch first."
        );
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

      // Last step — nothing left to auto-advance to, just close it.
      applyExpandedStepChange(null);
      return;
    }

    const missingStep = steps.find((step) => !step.confirmed);
    if (missingStep) {
      showCtaError(`Confirm ${missingStep.title} before adding to cart.`);
      applyExpandedStepChange(missingStep.id);
      return;
    }

    const cartInput: ConfiguredCartItemInput = {
      productId,
      productName,
      previewImage: product?.defaultImage ?? "/flatlays/regulartee.webp",
      colour,
      artwork,
      neckLabel: neckLabel?.fileUrl ? neckLabel : undefined,
      quantity,
      rushDelivery: false,
    };
    const targetCartId = upsertConfiguredCartItem(configId, cartInput, {
      cartId: editCartId ?? undefined,
      itemId: editItemId ?? undefined,
    });
    // The in-progress build draft's job is done now that it's been handed
    // off to the cart draft — clear it so a stale autosave doesn't resurface
    // if the customer starts a fresh build under the same configId later.
    clearBuildDraft(configId);
    router.push(`/configurator/cart/${encodeURIComponent(targetCartId)}/review`);
  }

  return (
    <ArtworkPositionProvider activeView={activeView}>
      <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-white text-[#111111]">
        <ConfiguratorHeader
          configId={configId}
          productName={productName}
          designPayload={{ colour, artwork, neckLabel, steps, quantity }}
        />

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
              <p className="mt-1 text-xs font-medium text-[#111111]/60">
                Step {buildProgress.current} of {buildProgress.total}: {buildProgress.label}
              </p>
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
                onExpandedStepChange={applyExpandedStepChange}
                onAttemptStepChange={handleExpandedStepChange}
                selectedColour={colour}
                onColourChange={(next) => {
                  setColour({ ...next, confirmed: false });
                  if (next.type === "custom_dye") {
                    setQuantity((prev) => Math.max(CUSTOM_DYE_MOQ_UNITS, prev));
                  }
                }}
                steps={steps}
                onStepsChange={setSteps}
                artwork={artwork}
                onArtworkChange={setArtwork}
                neckLabel={neckLabel}
                onNeckLabelChange={setNeckLabel}
                activeView={activeView}
                onViewChange={setActiveView}
                unitBasePrice={unitBasePrice}
                isToteProduct={isToteProduct}
                onResetStep={resetStepDraft}
              />
            </div>
          </aside>

          {unsavedStepId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/78 px-4 backdrop-blur-[1px]">
              <div className="w-full max-w-sm rounded-lg bg-white p-5 text-center shadow-xl ring-1 ring-[#111111]/10">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#FFF4DE] text-[#C47A00]">
                  <AlertTriangle size={20} strokeWidth={2.3} />
                </div>
                <h2 className="mt-4 text-xl font-semibold text-[#111111]">Unsaved Changes</h2>
                <p className="mt-2 text-sm leading-snug text-[#111111]/70">
                  You didn&apos;t save your {getStepTitle(unsavedStepId, isToteProduct)}. Confirm it to keep your
                  changes.
                </p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={discardUnsavedChanges}
                    className="min-h-11 rounded-full border border-[var(--color-teal)] px-3 text-sm font-semibold text-[var(--color-teal)] hover:bg-[var(--color-teal)] hover:text-white"
                  >
                    Discard Changes
                  </button>
                  <button
                    type="button"
                    onClick={keepEditing}
                    className="min-h-11 rounded-full bg-[var(--color-teal)] px-3 text-sm font-semibold text-white hover:bg-[var(--color-teal-dark)]"
                  >
                    Keep Editing
                  </button>
                </div>
              </div>
            </div>
          )}

          <main className="order-1 relative flex min-h-0 min-w-0 flex-col items-center justify-center overflow-hidden rounded-2xl border border-[#ECE7DF] bg-white lg:order-2">
            <GarmentPreview
              activeView={activeView}
              onViewChange={setActiveView}
              colourHex={colour.hex}
              productId={productId}
              artwork={artwork}
              neckLabel={neckLabel}
            />
            <div className="fixed bottom-4 right-4 z-40 lg:absolute lg:z-10">
              <WhatsAppAssistantBar configId={configId} />
            </div>
          </main>

          <aside className="order-3 flex min-h-0 min-w-0 flex-col justify-between gap-3 overflow-hidden">
            <div className="rounded-2xl border border-[#ECE7DF] bg-white p-4 shadow-[0_4px_16px_rgba(22,33,43,0.04)]">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#111111]/45">
                Studio Summary
              </p>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-[#111111]/55">Colour</span>
                  <span className="text-right font-medium">{colour.name || "Not selected"}</span>
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
                  <span className="text-[#111111]/55">{isToteProduct ? "Bag label" : "Neck label"}</span>
                  <span className="text-right font-medium">
                    {neckLabel?.confirmed ? "Added" : "Not added"}
                  </span>
                </div>
                <div className="flex justify-between gap-4 border-t border-[#E5E5E5] pt-3">
                  <span className="text-[#111111]/55">Unit price</span>
                  <span className="text-right font-medium">
                    {formatInr(configuredUnitCost)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-[#111111]/55">Order total</span>
                  <span className="text-right font-semibold">
                    {formatInr(configuredOrderTotal)}
                  </span>
                </div>
              </div>
            </div>

            <div className="shrink-0">
              <OrderBar
                quantity={quantity}
                onQuantityChange={setSafeQuantity}
                minQuantity={minimumQuantity}
                ctaLabel={getCtaLabel(expandedStepId)}
                onCtaClick={handleCtaClick}
                productId={productId}
                steps={steps}
                colour={colour}
                artwork={artwork}
                neckLabel={neckLabel}
                ctaErrorMessage={ctaErrorMessage}
                ctaErrorNonce={ctaErrorNonce}
              />
            </div>
          </aside>
        </div>
      </div>
    </ArtworkPositionProvider>
  );
}
