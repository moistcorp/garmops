"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, FileCheck2, Redo2, RotateCcw, Undo2 } from "lucide-react";
import type { GarmentView } from "@/lib/configurator/types/garment";
import type { GarmentColour, Artwork, NeckLabel } from "@/lib/configurator/types/configurator";
import GarmentPreview from "./GarmentPreview/GarmentPreview";
import CanvasRenderer from "./GarmentPreview/CanvasRenderer";
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
import {
  formatInr,
  getBasePrice,
  getVolumeDiscountPercent,
  VOLUME_DISCOUNT_TIERS,
  buildPricingBreakdown,
  getConfiguredPricingSummary,
  GST_PERCENT,
} from "@/lib/configurator/pricing";
import { CUSTOM_DYE_MOQ_UNITS } from "@/lib/configurator/colours";
import {
  readDraft,
  writeDraft,
  totalUnits,
  upsertConfiguredCartItem,
  splitQuantityAcrossSizes,
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
  revokeObjectUrl,
} from "@/lib/configurator/objectUrls";
import { generateApprovalPdf } from "@/lib/configurator/approvalPdf";
import { RESERVATION_FEE } from "@/lib/configurator/reservation";
import { ConfiguratorJourney } from "./ConfiguratorJourney";
import { NetworkStatusBanner } from "./NetworkStatusBanner";
import { ActionFeedback, type ActionFeedbackTone } from "./ActionFeedback";
import { trackConfiguratorEvent } from "@/lib/configurator/analytics";
import { getDeliveryFeasibility } from "@/lib/configurator/deliveryFeasibility";
import { readPreferredQuantity, readPreferredTargetDate } from "@/lib/configurator/clientPreferences";


type ConfiguratorSnapshot = {
  activeView: GarmentView;
  expandedStepId: AccordionStepId | null;
  quantity: number;
  colour: GarmentColour;
  artwork: Artwork;
  neckLabel: NeckLabel;
  steps: AccordionStepState[];
};

interface FeedbackState {
  tone: ActionFeedbackTone;
  title: string;
  detail?: string;
  retryPdf?: boolean;
}

function snapshotKey(snapshot: ConfiguratorSnapshot): string {
  return JSON.stringify(snapshot);
}

interface ConfigureClientProps {
  configId: string;
}

const POSITION_LABELS: Record<NeckLabel["position"], string> = {
  below_neck_tape: "Below neck tape",
  on_neck_tape: "On neck tape",
};

const FALLBACK_PRODUCT_ID = "regular-fit-tee-200gsm";

function safeQuantity(value: unknown, minimum = 50): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.floor(parsed)) : minimum;
}

function artworkSummary(artwork: Artwork): string | null {
  const summary = [
    artwork.front?.technique && `Front - ${TECHNIQUE_LABELS[artwork.front.technique]}`,
    artwork.back?.technique && `Back - ${TECHNIQUE_LABELS[artwork.back.technique]}`,
  ]
    .filter(Boolean)
    .join(", ");
  return summary || null;
}

function labelSummary(neckLabel?: NeckLabel): string | null {
  if (!neckLabel?.fileUrl || !neckLabel.dimensions || !neckLabel.position) return null;
  return `${neckLabel.dimensions.replace("x", "x")}mm - ${POSITION_LABELS[neckLabel.position]}`;
}

function stepsForConfiguration(
  colour: GarmentColour,
  artwork: Artwork,
  neckLabel?: NeckLabel,
  restoredSteps?: AccordionStepState[]
): AccordionStepState[] {
  return INITIAL_STEPS.map((step) => {
    const restored = restoredSteps?.find((candidate) => candidate.id === step.id);
    if (step.id === "garment-colour") {
      return {
        ...step,
        confirmed: colour.confirmed,
        summary: `${colour.type === "signature" ? "Signature" : "Custom Dye"} - ${colour.name}`,
      };
    }
    if (step.id === "artwork") {
      const summary = artworkSummary(artwork);
      return {
        ...step,
        confirmed: restored?.confirmed ?? Boolean(summary),
        skipped: !summary && restored?.skipped === true,
        summary: summary ?? (restored?.skipped ? "Skipped - blank garment" : null),
      };
    }
    const summary = labelSummary(neckLabel);
    return {
      ...step,
      confirmed: restored?.confirmed ?? Boolean(summary),
      skipped: !summary && restored?.skipped === true,
      summary: summary ?? (restored?.skipped ? "Skipped - standard label only" : null),
    };
  });
}

function getCtaLabel(
  openStep: AccordionStepId | null,
  artwork: Artwork,
  neckLabel?: NeckLabel
): string {
  if (openStep === "garment-colour") return "Continue";
  if (openStep === "artwork") {
    return artwork.front || artwork.back ? "Continue" : "Skip artwork";
  }
  if (openStep === "neck-label") {
    return neckLabel?.fileUrl ? "Continue to sizes" : "Skip label & continue";
  }
  return "Continue to sizes";
}

function getBuildProgress(steps: AccordionStepState[]) {
  const nextStepIndex = steps.findIndex((step) => !step.confirmed && !step.skipped);
  const currentStepIndex = nextStepIndex === -1 ? steps.length - 1 : nextStepIndex;
  const stepLabel = steps[currentStepIndex]?.title.replace("Garment ", "") ?? "Colour";
  return { current: currentStepIndex + 1, total: steps.length, label: stepLabel };
}

function getVolumeDiscountProgress(quantity: number) {
  const currentPercent = getVolumeDiscountPercent(quantity);
  const currentTierIndex = VOLUME_DISCOUNT_TIERS.findIndex(
    (tier) => quantity >= tier.minQty && (tier.maxQty === null || quantity <= tier.maxQty)
  );
  const currentTier = VOLUME_DISCOUNT_TIERS[currentTierIndex] ?? VOLUME_DISCOUNT_TIERS[0];
  const nextTier = VOLUME_DISCOUNT_TIERS[currentTierIndex + 1];
  if (!nextTier) {
    return { currentPercent, nextPercent: null, unitsToNext: 0, progressFraction: 1, isMaxed: true };
  }
  const span = nextTier.minQty - currentTier.minQty;
  const progressFraction = span > 0 ? Math.min(1, Math.max(0, (quantity - currentTier.minQty) / span)) : 1;
  return {
    currentPercent,
    nextPercent: nextTier.discountPercent,
    unitsToNext: Math.max(0, nextTier.minQty - quantity),
    progressFraction,
    isMaxed: false,
  };
}

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
  const [expandedStepId, setExpandedStepId] = useState<AccordionStepId | null>("garment-colour");
  const [quantity, setQuantity] = useState(50);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [ctaErrorMessage, setCtaErrorMessage] = useState<string | null>(null);
  const [ctaErrorNonce, setCtaErrorNonce] = useState(0);
  const [colour, setColour] = useState<GarmentColour>(DEFAULT_COLOUR);
  const [artwork, setArtwork] = useState<Artwork>({});
  const [neckLabel, setNeckLabel] = useState<NeckLabel>({} as NeckLabel);
  const [steps, setSteps] = useState<AccordionStepState[]>(() =>
    stepsForConfiguration(DEFAULT_COLOUR, {}, undefined)
  );
  const [draftRestored, setDraftRestored] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [preferredTargetDate, setPreferredTargetDate] = useState("");
  const [historyVersion, setHistoryVersion] = useState(0);
  const hasHydrated = useRef(false);
  const historyRef = useRef<ConfiguratorSnapshot[]>([]);
  const historyIndexRef = useRef(-1);
  const historyTimerRef = useRef<number | null>(null);
  const restoringHistoryRef = useRef(false);
  const saveTimer = useRef<number | null>(null);
  const saveStatusTimer = useRef<number | null>(null);
  const autosaveErrorNotifiedRef = useRef(false);
  const retainedObjectUrlsRef = useRef<Set<string>>(new Set());

  const pricingBreakdown = buildPricingBreakdown(productId, colour, artwork, neckLabel, quantity);
  const minimumQuantity = colour.type === "custom_dye" ? CUSTOM_DYE_MOQ_UNITS : 50;
  const buildProgress = getBuildProgress(steps);
  const discountProgress = getVolumeDiscountProgress(quantity);

  useEffect(() => {
    [artwork.front?.fileUrl, artwork.back?.fileUrl, neckLabel?.fileUrl].forEach((url) => {
      if (url?.startsWith("blob:")) retainedObjectUrlsRef.current.add(url);
    });
  }, [artwork.front?.fileUrl, artwork.back?.fileUrl, neckLabel?.fileUrl]);

  useEffect(() => {
    const retainedUrls = retainedObjectUrlsRef.current;
    return () => retainedUrls.forEach((url) => revokeObjectUrl(url));
  }, []);

  useEffect(() => {
    setPreferredTargetDate(readPreferredTargetDate());
    const preferredQuantity = readPreferredQuantity();
    if (preferredQuantity) setQuantity((current) => current === 50 ? preferredQuantity : current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const applyRestoredConfiguration = async (
        restoredColour: GarmentColour,
        restoredArtwork: Artwork,
        restoredNeckLabel: NeckLabel | undefined,
        restoredQuantity: unknown,
        restoredSteps?: AccordionStepState[]
      ) => {
        const uploads = await restoreConfigurationUploads(restoredArtwork, restoredNeckLabel);
        if (cancelled) return;
        setColour(restoredColour);
        setArtwork(uploads.artwork);
        setNeckLabel((uploads.neckLabel ?? {}) as NeckLabel);
        setSteps(stepsForConfiguration(restoredColour, uploads.artwork, uploads.neckLabel, restoredSteps));
        setQuantity(
          safeQuantity(
            restoredQuantity,
            restoredColour.type === "custom_dye" ? CUSTOM_DYE_MOQ_UNITS : 50
          )
        );
        setDraftRestored(true);
      };

      if (editCartId && editItemId) {
        const item = readDraft(editCartId).items.find((candidate) => candidate.id === editItemId);
        if (item && item.productId === productId) {
          await applyRestoredConfiguration(
            item.colour,
            item.artwork,
            item.neckLabel,
            totalUnits(item.sizeQuantities)
          );
          hasHydrated.current = true;
          setHistoryVersion((value) => value + 1);
          return;
        }
      }

      const draft = readBuildDraft(configId);
      if (hasMeaningfulDraft(draft) && draft) {
        await applyRestoredConfiguration(
          draft.colour,
          draft.artwork,
          draft.neckLabel,
          draft.quantity,
          draft.steps
        );
      }
      hasHydrated.current = true;
      setHistoryVersion((value) => value + 1);
    })().catch(() => {
      if (cancelled) return;
      hasHydrated.current = true;
      setFeedback({ tone: "error", title: "Saved design could not be restored", detail: "The Studio opened with safe defaults. Re-upload any missing artwork and continue." });
      setHistoryVersion((value) => value + 1);
    });

    return () => {
      cancelled = true;
    };
  }, [configId, editCartId, editItemId, productId]);

  useEffect(() => {
    if (!hasHydrated.current) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    if (saveStatusTimer.current) window.clearTimeout(saveStatusTimer.current);
    setSaveStatus("saving");
    saveTimer.current = window.setTimeout(() => {
      const saved = writeBuildDraft(configId, { colour, artwork, neckLabel, steps, quantity });
      setSaveStatus(saved ? "saved" : "error");
      if (!saved && !autosaveErrorNotifiedRef.current) {
        autosaveErrorNotifiedRef.current = true;
        setFeedback({
          tone: "error",
          title: "Browser autosave is unavailable",
          detail: "Your design is still active in this tab. Keep it open, download an approval PDF, or continue to the cart before leaving.",
        });
      }
      if (saved) {
        autosaveErrorNotifiedRef.current = false;
        saveStatusTimer.current = window.setTimeout(() => setSaveStatus("idle"), 1800);
      }
    }, 450);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      if (saveStatusTimer.current) window.clearTimeout(saveStatusTimer.current);
    };
  }, [configId, colour, artwork, neckLabel, steps, quantity]);

  useEffect(() => {
    if (!hasHydrated.current || restoringHistoryRef.current) return;
    if (historyTimerRef.current) window.clearTimeout(historyTimerRef.current);
    historyTimerRef.current = window.setTimeout(() => {
      const snapshot: ConfiguratorSnapshot = {
        activeView, expandedStepId, quantity, colour, artwork, neckLabel, steps,
      };
      const key = snapshotKey(snapshot);
      const current = historyRef.current[historyIndexRef.current];
      if (current && snapshotKey(current) === key) return;
      const nextHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
      nextHistory.push(snapshot);
      historyRef.current = nextHistory.slice(-30);
      historyIndexRef.current = historyRef.current.length - 1;
      setHistoryVersion((value) => value + 1);
    }, 320);
    return () => { if (historyTimerRef.current) window.clearTimeout(historyTimerRef.current); };
  }, [activeView, expandedStepId, quantity, colour, artwork, neckLabel, steps, historyVersion]);

  function restoreSnapshot(snapshot: ConfiguratorSnapshot) {
    restoringHistoryRef.current = true;
    setActiveView(snapshot.activeView);
    setExpandedStepId(snapshot.expandedStepId);
    setQuantity(snapshot.quantity);
    setColour(snapshot.colour);
    setArtwork(snapshot.artwork);
    setNeckLabel(snapshot.neckLabel);
    setSteps(snapshot.steps);
    window.setTimeout(() => { restoringHistoryRef.current = false; }, 0);
  }

  function undoConfiguration() {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    restoreSnapshot(historyRef.current[historyIndexRef.current]);
    setHistoryVersion((value) => value + 1);
    trackConfiguratorEvent("configuration_undo", { product_id: productId });
  }

  function redoConfiguration() {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    restoreSnapshot(historyRef.current[historyIndexRef.current]);
    setHistoryVersion((value) => value + 1);
    trackConfiguratorEvent("configuration_redo", { product_id: productId });
  }

  function resetConfiguration() {
    setActiveView("front");
    setExpandedStepId("garment-colour");
    setColour(DEFAULT_COLOUR);
    setArtwork({});
    setNeckLabel({} as NeckLabel);
    setSteps(stepsForConfiguration(DEFAULT_COLOUR, {}, undefined));
    setQuantity(50);
    setFeedback({ tone: "info", title: "Configuration reset", detail: "The product is back to its default colour and blank branding state." });
    trackConfiguratorEvent("configuration_reset", { product_id: productId });
  }

  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current >= 0 && historyIndexRef.current < historyRef.current.length - 1;
  const deliveryFeasibility = useMemo(
    () => getDeliveryFeasibility(preferredTargetDate, colour.type === "custom_dye" ? 7 : 0),
    [preferredTargetDate, colour.type]
  );

  function showCtaError(message: string) {
    setCtaErrorMessage(message);
    setCtaErrorNonce((previous) => previous + 1);
  }

  function setSafeQuantity(next: number) {
    setQuantity(safeQuantity(next, minimumQuantity));
  }

  function applyExpandedStepChange(next: AccordionStepId | null) {
    const wasLabel = expandedStepId === "neck-label";
    setExpandedStepId(next);
    if (next === "neck-label") setActiveView("neck");
    else if (wasLabel) setActiveView("front");
  }

  function updateStep(id: AccordionStepId, patch: Partial<AccordionStepState>) {
    setSteps((current) =>
      current.map((step) => (step.id === id ? { ...step, ...patch } : step))
    );
  }

  function resetStepDraft(stepId: AccordionStepId) {
    if (stepId === "garment-colour") {
      setColour(DEFAULT_COLOUR);
      updateStep("garment-colour", {
        confirmed: false,
        skipped: false,
        summary: `Signature - ${DEFAULT_COLOUR.name}`,
      });
    }
    if (stepId === "artwork") {
      setArtwork({});
      updateStep("artwork", { confirmed: false, skipped: false, summary: null });
    }
    if (stepId === "neck-label") {
      setNeckLabel({} as NeckLabel);
      updateStep("neck-label", { confirmed: false, skipped: false, summary: null });
    }
  }

  function addConfigurationToCart(overrides?: {
    artwork?: Artwork;
    neckLabel?: NeckLabel;
  }) {
    const cartArtwork = overrides?.artwork ?? artwork;
    const cartNeckLabel = overrides?.neckLabel ?? neckLabel;
    const cartInput: ConfiguredCartItemInput = {
      productId,
      productName,
      previewImage: product?.defaultImage ?? "/flatlays/regulartee.webp",
      colour: { ...colour, confirmed: true },
      artwork: cartArtwork,
      neckLabel: cartNeckLabel?.fileUrl ? cartNeckLabel : undefined,
      quantity,
      rushDelivery: false,
    };
    const targetCartId = upsertConfiguredCartItem(configId, cartInput, {
      cartId: editCartId ?? undefined,
      itemId: editItemId ?? undefined,
    });
    if (!targetCartId) {
      setFeedback({
        tone: "error",
        title: "Could not save this product to the cart",
        detail: "Your configuration is still open. Free some browser storage or try another browser before continuing.",
      });
      return;
    }

    if (preferredTargetDate) {
      const targetDraft = readDraft(targetCartId);
      if (!targetDraft.selectedDeliveryDateIso) {
        const dateSaved = writeDraft(targetCartId, {
          ...targetDraft,
          selectedDeliveryDateIso: new Date(`${preferredTargetDate}T12:00:00`).toISOString(),
          deliveryType: "flexible",
        });
        if (!dateSaved) {
          try {
            window.sessionStorage.setItem(
              "garmops:cart-update",
              "Product saved, but the target date could not be retained. Select it again before payment."
            );
          } catch {
            // The review page remains usable even when session storage is unavailable.
          }
        }
      }
    }
    if (editCartId && typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem("garmops:cart-update", "Design updated successfully.");
      } catch {
        // The cart itself is already saved; this success toast is optional.
      }
    }
    trackConfiguratorEvent("added_to_cart", { product_id: productId, quantity, editing: Boolean(editCartId) });
    clearBuildDraft(configId);
    router.push(`/configurator/cart/${encodeURIComponent(targetCartId)}/review`);
  }

  function handleCtaClick() {
    setCtaErrorMessage(null);

    if (expandedStepId === "garment-colour") {
      if (!colour.name) {
        showCtaError("Choose a garment colour to continue.");
        return;
      }
      const confirmedColour = { ...colour, confirmed: true };
      setColour(confirmedColour);
      trackConfiguratorEvent("colour_selected", { product_id: productId, colour: confirmedColour.name, colour_type: confirmedColour.type });
      updateStep("garment-colour", {
        confirmed: true,
        skipped: false,
        summary: `${confirmedColour.type === "signature" ? "Signature" : "Custom Dye"} - ${confirmedColour.name}`,
      });
      setActiveView("front");
      applyExpandedStepChange("artwork");
      return;
    }

    if (expandedStepId === "artwork") {
      const hasArtwork = Boolean(artwork.front || artwork.back);
      if (!hasArtwork) {
        trackConfiguratorEvent("artwork_skipped", { product_id: productId });
        updateStep("artwork", {
          confirmed: true,
          skipped: true,
          summary: "Skipped - blank garment",
        });
        applyExpandedStepChange("neck-label");
        return;
      }
      const missingTechnique = (["front", "back"] as const).find(
        (side) => artwork[side]?.fileUrl && !artwork[side]?.technique
      );
      if (missingTechnique) {
        showCtaError(
          `Choose a technique for the ${missingTechnique} artwork or use Recommend for me.`
        );
        return;
      }
      const readyArtwork: Artwork = {
        front: artwork.front ? { ...artwork.front, confirmed: true } : undefined,
        back: artwork.back ? { ...artwork.back, confirmed: true } : undefined,
      };
      setArtwork(readyArtwork);
      updateStep("artwork", {
        confirmed: true,
        skipped: false,
        summary: artworkSummary(readyArtwork),
      });
      applyExpandedStepChange("neck-label");
      return;
    }

    if (expandedStepId === "neck-label") {
      if (!neckLabel?.fileUrl) {
        trackConfiguratorEvent("neck_label_skipped", { product_id: productId, step: "neck_label" });
        updateStep("neck-label", {
          confirmed: true,
          skipped: true,
          summary: "Skipped - standard label only",
        });
        addConfigurationToCart();
        return;
      }
      const isReady = Boolean(
        neckLabel.dimensions &&
          neckLabel.position &&
          (neckLabel.position !== "below_neck_tape" || neckLabel.stitch)
      );
      if (!isReady) {
        showCtaError("Choose label dimensions, position and stitch to continue.");
        return;
      }
      const readyLabel = { ...neckLabel, confirmed: true };
      setNeckLabel(readyLabel);
      updateStep("neck-label", {
        confirmed: true,
        skipped: false,
        summary: labelSummary(readyLabel),
      });
      addConfigurationToCart({ neckLabel: readyLabel });
      return;
    }

    addConfigurationToCart();
  }

  async function handleDownloadPdf() {
    setIsDownloadingPdf(true);
    setFeedback({ tone: "loading", title: "Preparing product preview…", detail: "Your current configuration remains editable while the document is created." });
    trackConfiguratorEvent("approval_pdf_started", { source: "studio", product_id: productId });
    try {
      const sizes = product?.sizes ?? ["XS", "S", "M", "L", "XL", "XXL"];
      const sizeQuantities = splitQuantityAcrossSizes(quantity, sizes);
      const pricing = getConfiguredPricingSummary(
        productId,
        colour,
        artwork,
        neckLabel?.fileUrl ? neckLabel : undefined,
        quantity
      );
      const garmentCanvas = document.querySelector<HTMLCanvasElement>(
        '[data-configurator-pdf-preview="true"] canvas'
      );
      let previewDataUrl: string | undefined;
      try {
        previewDataUrl = garmentCanvas?.toDataURL("image/jpeg", 0.86);
      } catch {
        previewDataUrl = undefined;
      }
      setFeedback({ tone: "loading", title: "Adding commercial and production details…" });
      await generateApprovalPdf({
        projectReference: configId,
        documentTitle: "Merch Design Summary",
        items: [
          {
            id: configId,
            productName,
            previewImage: product?.defaultImage ?? "/flatlays/regulartee.webp",
            colour,
            artwork,
            neckLabel: neckLabel?.fileUrl ? neckLabel : undefined,
            sizeQuantities,
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
        previewDataUrls: { [configId]: previewDataUrl },
        filename: `Garmops-Design-${configId}.pdf`,
      });
      setFeedback({ tone: "success", title: "Design PDF downloaded", detail: "The document is a dated snapshot of this configuration." });
      trackConfiguratorEvent("approval_pdf_downloaded", { source: "studio", product_id: productId });
    } catch {
      setFeedback({ tone: "error", title: "PDF generation failed", detail: "Your configuration is safe. Check your connection and try downloading again.", retryPdf: true });
      trackConfiguratorEvent("approval_pdf_failed", { source: "studio", product_id: productId });
    } finally {
      setIsDownloadingPdf(false);
    }
  }

  return (
    <ArtworkPositionProvider activeView={activeView}>
      <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-white text-[#111111]">
        <NetworkStatusBanner />
        <ConfiguratorHeader
          configId={configId}
          productName={productName}
          onDownloadPdf={handleDownloadPdf}
          isDownloadingPdf={isDownloadingPdf}
        />
        <ConfiguratorJourney currentStep="customise" compact links={{ product: "/configurator" }} className="mx-4 mb-3 shrink-0" />

        {feedback && (
          <div className="fixed right-4 top-24 z-[70] w-[min(380px,calc(100vw-2rem))]">
            <ActionFeedback {...feedback} onDismiss={feedback.tone === "loading" ? undefined : () => setFeedback(null)} actionLabel={feedback.retryPdf ? "Try PDF again" : undefined} onAction={feedback.retryPdf ? handleDownloadPdf : undefined} />
          </div>
        )}

        <div
          data-configurator-pdf-preview="true"
          aria-hidden="true"
          className="pointer-events-none fixed -left-[10000px] top-0 h-[640px] w-[480px] opacity-0"
        >
          <ArtworkPositionProvider activeView="front">
            <CanvasRenderer
              view="front"
              colourHex={colour.hex}
              productId={productId}
              artwork={artwork}
              neckLabel={neckLabel}
              interactive={false}
              className="h-full w-full bg-[#F7F7F7]"
            />
          </ArtworkPositionProvider>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 px-4 pb-4 lg:grid-cols-[320px_minmax(0,1fr)_280px] xl:grid-cols-[360px_minmax(0,1fr)_310px] lg:px-5">
          <aside className="order-2 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[28px] border border-[#E5E5E5] bg-white lg:order-1">
            <div className="border-b border-[#E5E5E5] px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#111111]/45">
                  Guided setup
                </p>
                <span
                  className={`text-[10px] font-medium uppercase tracking-wide transition-opacity ${
                    saveStatus === "error" ? "text-[#A63A3A]" : "text-[#111111]/45"
                  }`}
                  aria-live="polite"
                >
                  {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : saveStatus === "error" ? "Could not save" : "Autosave on"}
                </span>
              </div>
              <h1 className="mt-1 text-lg font-semibold text-[#111111]">{productName}</h1>
              <p className="mt-1 text-xs font-medium text-[#111111]/60">
                Step {buildProgress.current} of {buildProgress.total}: {buildProgress.label}
              </p>
              <div className="mt-2 flex items-center gap-1" aria-label="Configuration history controls">
                <button type="button" onClick={undoConfiguration} disabled={!canUndo} className="flex h-8 items-center gap-1 rounded-full border border-[#E5E5E5] px-2.5 text-[11px] font-semibold text-[#111111]/60 disabled:opacity-35"><Undo2 size={13} /> Undo</button>
                <button type="button" onClick={redoConfiguration} disabled={!canRedo} className="flex h-8 items-center gap-1 rounded-full border border-[#E5E5E5] px-2.5 text-[11px] font-semibold text-[#111111]/60 disabled:opacity-35"><Redo2 size={13} /> Redo</button>
                <button type="button" onClick={resetConfiguration} className="flex h-8 items-center gap-1 rounded-full border border-[#E5E5E5] px-2.5 text-[11px] font-semibold text-[#A63A3A]"><RotateCcw size={13} /> Reset</button>
              </div>
              {draftRestored && (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-[#F7F7F7] px-2.5 py-1.5 text-xs text-[#111111]/65">
                  <span>Restored your saved progress.</span>
                  <button
                    type="button"
                    onClick={() => setDraftRestored(false)}
                    aria-label="Dismiss"
                    className="shrink-0 font-semibold text-[#111111]/50 hover:text-[#111111]"
                  >
                    x
                  </button>
                </div>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3">
              <ConfiguratorSidebar
                expandedStepId={expandedStepId}
                onExpandedStepChange={applyExpandedStepChange}
                selectedColour={colour}
                onColourChange={(next) => {
                  const pendingColour = { ...next, confirmed: false };
                  setColour(pendingColour);
                  updateStep("garment-colour", {
                    confirmed: false,
                    skipped: false,
                    summary: `${next.type === "signature" ? "Signature" : "Custom Dye"} - ${next.name}`,
                  });
                  if (next.type === "custom_dye") {
                    setQuantity((current) => Math.max(CUSTOM_DYE_MOQ_UNITS, current));
                  }
                }}
                steps={steps}
                onStepsChange={setSteps}
                artwork={artwork}
                onArtworkChange={(next) => {
                  setArtwork(next);
                  updateStep("artwork", {
                    confirmed: false,
                    skipped: false,
                    summary: artworkSummary(next),
                  });
                }}
                neckLabel={neckLabel}
                onNeckLabelChange={(next) => {
                  setNeckLabel(next);
                  updateStep("neck-label", {
                    confirmed: false,
                    skipped: false,
                    summary: labelSummary(next),
                  });
                }}
                activeView={activeView}
                onViewChange={setActiveView}
                unitBasePrice={unitBasePrice}
                isToteProduct={isToteProduct}
                onResetStep={resetStepDraft}
              />
            </div>
          </aside>

          <main
            data-configurator-preview="true"
            className="order-1 relative flex min-h-0 min-w-0 flex-col items-center justify-center overflow-hidden rounded-2xl border border-[#ECE7DF] bg-[#F5F5F5] lg:order-2"
          >
            <GarmentPreview
              activeView={activeView}
              onViewChange={setActiveView}
              colourHex={colour.hex}
              colourName={colour.name}
              productId={productId}
              artwork={artwork}
              neckLabel={neckLabel}
            />
            <div className="fixed bottom-4 right-4 z-40 lg:absolute lg:z-10">
              <WhatsAppAssistantBar configId={configId} />
            </div>
          </main>

          <aside className="order-3 flex min-h-0 min-w-0 flex-col justify-between gap-3 overflow-y-auto">
            <div className="rounded-[28px] border border-[#ECE7DF] bg-white p-4 shadow-[0_4px_16px_rgba(22,33,43,0.04)]">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#111111]/45">
                  Studio summary
                </p>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${saveStatus === "error" ? "bg-[#FFF0F0] text-[#A63A3A]" : "bg-[#EAF7EA] text-[#1B7F36]"}`}>
                  <FileCheck2 size={12} strokeWidth={2.3} />
                  {saveStatus === "saving" ? "Saving" : saveStatus === "error" ? "Save unavailable" : "Autosaved"}
                </span>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-[#111111]/55">Colour</span>
                  <span className="text-right font-medium">{colour.name || "Not selected"}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-[#111111]/55">Fabric</span>
                  <span className="text-right font-medium">{product?.details?.[0] ?? "-"}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-[#111111]/55">Artwork</span>
                  <span className="text-right font-medium">
                    {[artwork.front && "Front", artwork.back && "Back"].filter(Boolean).join(" + ") || "Not added"}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-[#111111]/55">{isToteProduct ? "Bag label" : "Neck label"}</span>
                  <span className="text-right font-medium">{neckLabel?.fileUrl ? "Added" : "Not added"}</span>
                </div>

                <div className={`rounded-xl border p-3 ${deliveryFeasibility.status === "comfortable" ? "border-[#CDE8D2] bg-[#F2FBF3]" : deliveryFeasibility.status === "review" ? "border-[#F0CACA] bg-[#FFF5F5]" : "border-[#E7C56A] bg-[#FFF8E7]"}`}>
                  <p className="text-xs font-semibold text-[#111111]">{deliveryFeasibility.label}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#111111]/60">{deliveryFeasibility.detail}</p>
                  {!preferredTargetDate && <a href="/configurator" className="mt-1 inline-block text-[11px] font-semibold text-[var(--color-teal-dark)] underline">Set required-by date</a>}
                </div>

                <div className="rounded-xl border border-[var(--color-teal)]/25 bg-[var(--color-teal)]/5 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-[#111111]">Due today</span>
                    <span className="text-lg font-bold text-[var(--color-teal-dark)]">
                      {formatInr(RESERVATION_FEE)}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#111111]/60">
                    Reservation fee credited against the final invoice. Production starts only after technical and commercial approval.
                  </p>
                </div>

                <div className="border-t border-[#E5E5E5] pt-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#111111]/55">Volume discount</span>
                    <span className="font-semibold text-[var(--color-teal)]">
                      {discountProgress.currentPercent}% off
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#EDEDE8]">
                    <div
                      className="h-full rounded-full bg-[var(--color-teal)] transition-[width] duration-300 ease-out"
                      style={{ width: `${discountProgress.progressFraction * 100}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs font-medium text-[#111111]/50">
                    {discountProgress.isMaxed
                      ? "You have unlocked our best volume price."
                      : `Add ${discountProgress.unitsToNext} more unit${discountProgress.unitsToNext === 1 ? "" : "s"} to reach ${discountProgress.nextPercent}% off.`}
                  </p>
                </div>

                <div className="border-t border-[#E5E5E5] pt-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[#111111]/55">Estimated unit price</span>
                    <span className="text-right font-medium">
                      {formatInr(pricingBreakdown.unitPrice * (1 - pricingBreakdown.discountPercent / 100))}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-4">
                    <span className="text-[#111111]/55">Estimated total incl. GST</span>
                    <span className="text-right font-semibold">{formatInr(pricingBreakdown.total)}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setBreakdownOpen((value) => !value)}
                    aria-expanded={breakdownOpen}
                    className="mt-2.5 flex w-full items-center justify-between gap-2 rounded-xl border border-[#ECE7DF] px-3 py-2 text-left text-xs font-semibold text-[#111111]/70 hover:border-[var(--color-teal)]"
                  >
                    <span>Pricing breakdown</span>
                    <ChevronDown
                      size={14}
                      strokeWidth={2.2}
                      className={`shrink-0 transition-transform duration-200 ${breakdownOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {breakdownOpen && (
                    <div className="mt-2 flex flex-col gap-1.5 rounded-xl bg-[#F7F7F7] p-3 text-xs">
                      {pricingBreakdown.rows.map((row) => (
                        <div key={`${row.label}-${row.detail ?? ""}`} className="flex items-center justify-between gap-3">
                          <span className="text-[#111111]/60">
                            {row.label}{row.detail ? ` (${row.detail})` : ""}
                          </span>
                          <span className="font-medium text-[#111111]">
                            {row.amount >= 0 ? "+" : "-"}{formatInr(Math.abs(row.amount))}
                          </span>
                        </div>
                      ))}
                      {pricingBreakdown.discountPercent > 0 && (
                        <div className="flex items-center justify-between gap-3 text-[#2E7D32]">
                          <span>Volume discount ({pricingBreakdown.discountPercent}%)</span>
                          <span className="font-medium">-{formatInr(pricingBreakdown.discountAmount)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-3 text-[#111111]/60">
                        <span>GST ({GST_PERCENT}%)</span>
                        <span className="font-medium text-[#111111]">{formatInr(pricingBreakdown.gst)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 border-t border-[#E5E5E5] pt-1.5 text-sm font-semibold text-[#111111]">
                        <span>Estimated order total</span>
                        <span>{formatInr(pricingBreakdown.total)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="shrink-0 lg:sticky lg:bottom-0">
              <OrderBar
                quantity={quantity}
                onQuantityChange={setSafeQuantity}
                minQuantity={minimumQuantity}
                ctaLabel={getCtaLabel(expandedStepId, artwork, neckLabel)}
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
