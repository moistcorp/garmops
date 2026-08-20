"use client";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronUp, Cloud, CloudAlert, LoaderCircle } from "lucide-react";
import type { GarmentView } from "@/lib/configurator/types/garment";
import { flatlayAssetPath } from "@/lib/publicAssets";
import {
  isCustomerArtworkTechnique,
  type GarmentColour,
  type Artwork,
  type NeckLabel,
} from "@/lib/configurator/types/configurator";
import GarmentPreview from "./GarmentPreview/GarmentPreview";
import CanvasRenderer, {
  type GarmentRenderResult,
} from "./GarmentPreview/CanvasRenderer";
import GarmopsLoadingScreen from "@/components/common/GarmopsLoadingScreen";
import {
  ConfiguratorSidebar,
  type AccordionStepId,
  type AccordionStepState,
  INITIAL_STEPS,
  DEFAULT_COLOUR,
} from "./ConfiguratorSidebar/ConfiguratorSidebar";
import { TECHNIQUE_LABELS } from "./ConfiguratorSidebar/ArtworkPanel/TechniqueSelect";
import { OrderBar } from "./OrderBar";
import { ConfiguratorTopBar } from "./ConfiguratorTopBar";
import type { ConfiguratorJourneyStep } from "./ConfiguratorJourney";
import { WhatsAppAssistantBar } from "./WhatsAppAssistantBar";
import { ArtworkPositionProvider } from "@/lib/configurator/ArtworkPositionContext";
import { getProductMinimumOrderQuantity, type Product } from "@/lib/configurator/products";
import {
  getBasePrice,
  buildPricingBreakdown,
  getConfiguredPricingSummary,
} from "@/lib/configurator/pricing";
import {
  createStandardNeckLabel,
  isCustomNeckLabel,
} from "@/lib/configurator/neckLabel";
import {
  CUSTOM_DYE_MOQ_UNITS,
  resolveSignatureColour,
} from "@/lib/configurator/colourRules";
import {
  readDraft,
  MAX_CONFIGURED_CART_ITEMS,
  totalUnits,
  writeDraft,
  splitQuantityAcrossSizes,
  type ConfiguredCartItemInput,
} from "./cart/cartDraft";
import { SIZES } from "./cart/SizeQuantityGrid";
import {
  addConfiguredLine,
  getCatalog,
  getServerPricing,
  resolveConfiguredCart,
  updateConfiguredLine,
  type PricingSnapshot,
} from "@/lib/medusa/commerce";
import {
  readBuildDraft,
  writeBuildDraft,
  clearBuildDraft,
  hasMeaningfulDraft,
  type BuildDraft,
} from "@/lib/configurator/buildDraft";
import {
  restoreConfigurationUploads,
  revokeObjectUrl,
} from "@/lib/configurator/objectUrls";
import { ActionFeedback, type ActionFeedbackTone } from "./ActionFeedback";
import { useCustomerSession } from "@/components/auth/useCustomerSession";
import CustomerAuthDialog from "@/components/auth/CustomerAuthDialog";
import { readPreferredQuantity } from "@/lib/configurator/clientPreferences";
import { getConfiguratorCtaLabel } from "@/lib/configurator/journey";
import { MAX_CONFIGURATION_QUANTITY } from "@/lib/configurator/sizeQuantity";
import {
  cloudSnapshotToBuildDraft,
  loadCloudDesign,
  readCloudDesignLink,
  writeEstimateForDesign,
  saveBuildDraftToCloud,
  writeCloudDesignLink,
  type CloudDesignLink,
  type CloudSaveConflict,
} from "@/lib/designs/client";
import {
  CONFIGURATOR_AUTH_RESUME_PARAM,
  configuratorAuthReturnPath,
  configuratorPathWithoutAuthResume,
  parseConfiguratorAuthResume,
  type ConfiguratorAuthResumeIntent,
} from "@/lib/configurator/authResume";

interface FeedbackState {
  tone: ActionFeedbackTone;
  title: string;
  detail?: string;
  retryPdf?: boolean;
}

interface ConfigureClientProps {
  configId: string;
  product: Product;
}

type CloudSaveStatus =
  | "local"
  | "saving"
  | "saved"
  | "error"
  | "conflict";

const POSITION_LABELS: Record<NeckLabel["position"], string> = {
  below_neck_tape: "Below neck tape",
  on_neck_tape: "On neck tape",
};

const JOURNEY_STEP_FOR_CUSTOMISATION: Record<AccordionStepId, ConfiguratorJourneyStep> = {
  "garment-colour": "colour",
  artwork: "artwork",
  "neck-label": "neck-label",
};

function safeQuantity(value: unknown, minimum = 50): number {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.min(MAX_CONFIGURATION_QUANTITY, Math.max(minimum, Math.floor(parsed)))
    : minimum;
}

function garmentRenderKey({
  productId,
  view,
  colourHex,
}: Pick<GarmentRenderResult, "productId" | "view" | "colourHex">): string {
  return `${productId}:${view}:${colourHex}`;
}

function garmentRenderProgressPoints(result: GarmentRenderResult): number {
  if (result.state === "ready" || result.state === "error") return 60;
  const layerProgress = result.totalLayers > 0
    ? (result.loadedLayers / result.totalLayers) * 48
    : 0;
  return Math.round(layerProgress + (result.state === "compositing" ? 7 : 0));
}

function artworkSummary(artwork: Artwork): string | null {
  const summary = [
    isCustomerArtworkTechnique(artwork.front?.technique) && `Front · ${TECHNIQUE_LABELS[artwork.front.technique]}`,
    isCustomerArtworkTechnique(artwork.back?.technique) && `Back · ${TECHNIQUE_LABELS[artwork.back.technique]}`,
  ]
    .filter(Boolean)
    .join(", ");
  return summary || null;
}

function labelSummary(neckLabel?: NeckLabel): string | null {
  if (!neckLabel) return null;
  if (!isCustomNeckLabel(neckLabel)) return "Standard size label";
  if (
    (!neckLabel?.fileUrl && !neckLabel?.fileId) ||
    !neckLabel.dimensions ||
    !neckLabel.position
  ) return null;
  return `${neckLabel.dimensions.replace("x", " × ")} mm · ${POSITION_LABELS[neckLabel.position]}`;
}

function resolveRestoredColour(colour: GarmentColour): {
  colour: GarmentColour;
  wasObsolete: boolean;
} {
  if (colour.type !== "signature") return { colour, wasObsolete: false };

  const current = resolveSignatureColour(colour);
  if (!current) return { colour: DEFAULT_COLOUR, wasObsolete: true };

  return {
    colour: {
      ...colour,
      id: current.id,
      name: current.name,
      hex: current.hex,
    },
    wasObsolete: false,
  };
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
        summary: `${colour.type === "signature" ? "Signature" : "Custom dye"} · ${colour.name}`,
      };
    }
    if (step.id === "artwork") {
      const summary = artworkSummary(artwork);
      return {
        ...step,
        confirmed: restored?.confirmed ?? Boolean(summary),
        skipped: !summary && restored?.skipped === true,
        summary: summary ?? (restored?.skipped ? "No artwork added" : null),
      };
    }
    const hasCustomAsset = Boolean(neckLabel?.fileUrl || neckLabel?.fileId);
    const summary = neckLabel?.confirmed || hasCustomAsset
      ? labelSummary(neckLabel)
      : null;
    return {
      ...step,
      confirmed: restored?.confirmed ?? Boolean(neckLabel?.confirmed || hasCustomAsset),
      skipped: !summary && restored?.skipped === true,
      summary: summary ?? (restored?.skipped ? "Standard size label" : null),
    };
  });
}

export default function ConfigureClient({ configId, product }: ConfigureClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const productId = product.id;
  const productName = product.name;
  const editCartId = searchParams.get("cartId");
  const editItemId = searchParams.get("itemId");
  const requestedStepParam = searchParams.get("step");
  const requestedDesignId = searchParams.get("designId");
  const requestedDraftId = searchParams.get("draftId");
  const requestedCloudSave = searchParams.get("cloudSave") === "1";
  const requestedSaveTitle = searchParams.get("saveTitle") ?? "";
  const requestedEstimateId = searchParams.get("estimateId");
  const requestedAuthResume = parseConfiguratorAuthResume(
    searchParams.get(CONFIGURATOR_AUTH_RESUME_PARAM),
  );
  const returnToSizeQuantity = searchParams.get("returnTo") === "size-quantity";
  const productCatalogHref = editCartId
    ? `/configurator?cartId=${encodeURIComponent(editCartId)}`
    : "/configurator";
  const designStorageKey = requestedDesignId
    ? `design:${requestedDesignId}`
    : editItemId
      ? `cart-item:${editItemId}`
      : `draft:${requestedDraftId ?? configId}`;
  const savedDesignsEnabled = process.env.NEXT_PUBLIC_CLOUD_DESIGNS_ENABLED === "true";
  const accountsEnabled = process.env.NEXT_PUBLIC_ACCOUNTS_ENABLED === "true";
  const customerSession = useCustomerSession(accountsEnabled);
  const requestedStep: AccordionStepId =
    requestedStepParam === "artwork" || requestedStepParam === "neck-label"
      ? requestedStepParam
      : "garment-colour";
  const isToteProduct = productId.includes("tote");
  let unitBasePrice: number | undefined;
  try {
    unitBasePrice = getBasePrice(productId);
  } catch {
    unitBasePrice = undefined;
  }

  const [activeView, setActiveView] = useState<GarmentView>(
    requestedStep === "neck-label" ? "neck" : "front"
  );
  const [expandedStepId, setExpandedStepId] = useState<AccordionStepId | null>(
    requestedStep
  );
  const [quantity, setQuantity] = useState(() =>
    getProductMinimumOrderQuantity(productId)
  );
  const [ctaErrorMessage, setCtaErrorMessage] = useState<string | null>(null);
  const [ctaErrorNonce, setCtaErrorNonce] = useState(0);
  const [colour, setColour] = useState<GarmentColour>(DEFAULT_COLOUR);
  const [artwork, setArtwork] = useState<Artwork>({});
  const [neckLabel, setNeckLabel] = useState<NeckLabel>(() => createStandardNeckLabel());
  const [neckLabelPreviewUrl, setNeckLabelPreviewUrl] = useState<string | undefined>();
  const [steps, setSteps] = useState<AccordionStepState[]>(() =>
    stepsForConfiguration(DEFAULT_COLOUR, {}, undefined)
  );
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [hydrationComplete, setHydrationComplete] = useState(false);
  const [previewRenderProgress, setPreviewRenderProgress] =
    useState<GarmentRenderResult | null>(null);
  const [previewLoadPoints, setPreviewLoadPoints] = useState(0);
  const [configuratorOpened, setConfiguratorOpened] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(() =>
    requestedAuthResume === "add-to-cart"
      ? {
          tone: "loading",
          title: "Restoring your cart action…",
          detail: "Your configuration is safe while we confirm your account.",
        }
      : null,
  );
  const [cloudLink, setCloudLink] = useState<CloudDesignLink | null>(null);
  const [cloudSaveStatus, setCloudSaveStatus] =
    useState<CloudSaveStatus>("local");
  const [cloudMessage, setCloudMessage] = useState(
    "Save to your account for cross-device access."
  );
  const [cloudConflict, setCloudConflict] =
    useState<CloudSaveConflict | null>(null);
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [designTitle, setDesignTitle] = useState("");
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authIntent, setAuthIntent] =
    useState<ConfiguratorAuthResumeIntent | null>(null);
  const hasHydrated = useRef(false);
  const saveTimer = useRef<number | null>(null);
  const autosaveErrorNotifiedRef = useRef(false);
  const retainedObjectUrlsRef = useRef<Set<string>>(new Set());
  const restoredSizeQuantitiesRef = useRef<Record<string, number> | null>(null);
  const cloudLinkRef = useRef<CloudDesignLink | null>(null);
  const cloudSaveTimer = useRef<number | null>(null);
  const cloudSaveInFlight = useRef(false);
  const pendingCloudSaveRef = useRef<{
    draft: BuildDraft;
    options?: {
      interactive?: boolean;
      forceRevision?: number;
      createCopy?: boolean;
      title?: string;
    };
  } | null>(null);
  const cloudSaveIntentHandled = useRef(false);
  const pendingCartCommitRef = useRef<(() => Promise<void>) | null>(null);
  const authResumeHandledRef = useRef(false);

  const pricingBreakdown = buildPricingBreakdown(productId, colour, artwork, neckLabel, quantity);
  const [serverPricing, setServerPricing] = useState<PricingSnapshot | null>(null);
  const [catalogProductActive, setCatalogProductActive] = useState<boolean | null>(null);
  const minimumQuantity = getProductMinimumOrderQuantity(productId, {
    colourType: colour.type,
    customDyeMinimum: CUSTOM_DYE_MOQ_UNITS,
  });
  const customDyeMinimumQuantity = getProductMinimumOrderQuantity(productId, {
    colourType: "custom_dye",
    customDyeMinimum: CUSTOM_DYE_MOQ_UNITS,
  });
  const customDyeQuantityShortfall =
    colour.type === "custom_dye" && quantity < minimumQuantity;
  const activePreviewKey = garmentRenderKey({
    productId,
    view: activeView,
    colourHex: colour.hex,
  });

  const handleGarmentRenderProgress = useCallback(
    (result: GarmentRenderResult) => {
      setPreviewRenderProgress(result);
      setPreviewLoadPoints((current) =>
        Math.max(current, garmentRenderProgressPoints(result))
      );
    },
    [],
  );
  const activePreviewProgress = previewRenderProgress &&
    garmentRenderKey(previewRenderProgress) === activePreviewKey
      ? previewRenderProgress
      : null;
  const activePreviewSettled = activePreviewProgress?.state === "ready" ||
    activePreviewProgress?.state === "error";
  const configuratorLoadProgress = Math.min(
    100,
    10 + (hydrationComplete ? 30 : 0) + previewLoadPoints,
  );
  const configuratorLoadingStatus = activePreviewProgress?.state === "compositing"
    ? "Rendering garment preview…"
    : activePreviewProgress?.state === "loading"
      ? `Loading preview layers ${activePreviewProgress.loadedLayers}/${activePreviewProgress.totalLayers}…`
      : !hydrationComplete
        ? "Restoring workspace details…"
        : activePreviewSettled
          ? "Final checks complete"
          : "Starting garment preview…";

  useEffect(() => {
    if (
      configuratorOpened ||
      !hydrationComplete ||
      !activePreviewSettled
    ) return;

    const frame = window.requestAnimationFrame(() => {
      setConfiguratorOpened(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activePreviewSettled, configuratorOpened, hydrationComplete]);

  useEffect(() => {
    let cancelled = false;
    void getCatalog().then((catalog) => {
      if (!cancelled) setCatalogProductActive(catalog.products.some((candidate) => candidate.slug === productId));
    }).catch(() => {
      if (!cancelled) setCatalogProductActive(null);
    });
    return () => { cancelled = true; };
  }, [productId]);
  const orderBarPricing = serverPricing
    ? {
        rows: serverPricing.adjustments.map((adjustment) => ({
          label: adjustment.label,
          amount: (adjustment.amountPaise ?? 0) / 100,
          detail: adjustment.percent !== undefined ? `${adjustment.percent}%` : undefined,
        })),
        unitPrice: serverPricing.configuredUnitPaise / 100,
        lineSubtotal: serverPricing.subtotalPaise / 100,
        discountPercent: serverPricing.discountPercent,
        discountAmount: serverPricing.volumeDiscountPaise / 100,
        taxable: (serverPricing.subtotalPaise + serverPricing.shippingPaise) / 100,
        gst: serverPricing.taxPaise / 100,
        total: serverPricing.totalPaise / 100,
      }
    : pricingBreakdown;

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void getServerPricing({
        productSlug: productId,
        quantity,
        colourType: colour.type,
        artwork: {
          front: artwork.front ? { fileId: artwork.front.fileId, fileUrl: artwork.front.fileUrl, technique: artwork.front.technique } : undefined,
          back: artwork.back ? { fileId: artwork.back.fileId, fileUrl: artwork.back.fileUrl, technique: artwork.back.technique } : undefined,
        },
        neckLabel: neckLabel ? { labelType: neckLabel.labelType, fileId: neckLabel.fileId, fileUrl: neckLabel.fileUrl } : undefined,
        deliveryType: "standard",
      }).then((pricing) => {
        if (!cancelled) setServerPricing(pricing);
      }).catch(() => {
        if (!cancelled) setServerPricing(null);
      });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [artwork.back, artwork.front, colour.type, neckLabel, productId, quantity]);
  const activeCustomisationStepId = expandedStepId ?? "garment-colour";
  const previewNeckLabel: NeckLabel =
    activeCustomisationStepId === "neck-label" && !neckLabel.dimensions
      ? {
          ...neckLabel,
          fileUrl: "",
          labelType: "standard-size",
          dimensions: neckLabel.dimensions ?? "50x18",
          position: neckLabel.position ?? "below_neck_tape",
          stitch: neckLabel.stitch ?? "2_corner",
          confirmed: false,
        }
      : neckLabel;
  const activeDrawerStep =
    steps.find((step) => step.id === activeCustomisationStepId) ?? INITIAL_STEPS[0];
  const activeDrawerStepLabel =
    isToteProduct && activeDrawerStep.id === "neck-label"
      ? "Bag Label"
      : activeDrawerStep.title.replace("Garment ", "");
  const activeControlSummary =
    activeDrawerStep.id === "garment-colour"
      ? `${colour.name} · ${colour.type === "signature" ? "Signature colour" : "Custom dye"}`
      : activeDrawerStep.id === "artwork"
        ? artwork.front && artwork.back
          ? "Front + back artwork added"
          : artwork.front
            ? "Front artwork added · Back not added"
            : artwork.back
              ? "Back artwork added · Front not added"
              : "No artwork added"
        : isCustomNeckLabel(neckLabel)
          ? neckLabel.fileUrl || neckLabel.fileId
            ? `${isToteProduct ? "Bag" : "Neck"} label added`
            : `Upload ${isToteProduct ? "bag" : "neck label"} artwork`
          : neckLabel?.confirmed
            ? `${isToteProduct ? "Standard bag" : "Standard size"} label selected`
            : `Choose a ${isToteProduct ? "bag" : "neck"} label`;
  const completedCustomisationSteps = new Set(
    steps
      .filter((step) => step.confirmed || step.skipped)
      .map((step) => step.id)
  );
  const journeyStepSelection: Partial<Record<ConfiguratorJourneyStep, () => void>> = {};
  if (completedCustomisationSteps.has("garment-colour")) {
    journeyStepSelection.colour = () => applyExpandedStepChange("garment-colour");
  }
  if (
    completedCustomisationSteps.has("artwork") ||
    activeCustomisationStepId === "neck-label"
  ) {
    journeyStepSelection.artwork = () => applyExpandedStepChange("artwork");
  }
  if (completedCustomisationSteps.has("neck-label")) {
    journeyStepSelection["neck-label"] = () => applyExpandedStepChange("neck-label");
  }

  function currentBuildDraft(): BuildDraft {
    return {
      version: 1,
      savedAt: new Date().toISOString(),
      colour,
      artwork,
      neckLabel,
      steps,
      quantity,
    };
  }

  const setActiveCloudLink = useCallback(
    (next: CloudDesignLink | null) => {
      cloudLinkRef.current = next;
      setCloudLink(next);
      if (next) writeCloudDesignLink(designStorageKey, next);
    },
    [designStorageKey, setCloudLink]
  );

  const applyRestoredConfiguration = useCallback(
    async (
      restoredColour: GarmentColour,
      restoredArtwork: Artwork,
      restoredNeckLabel: NeckLabel | undefined,
      restoredQuantity: unknown,
      restoredSteps?: AccordionStepState[]
    ) => {
      const resolvedColour = resolveRestoredColour(restoredColour);
      const uploads = await restoreConfigurationUploads(
        restoredArtwork,
        restoredNeckLabel
      );
      setColour(resolvedColour.colour);
      setArtwork(uploads.artwork);
      setNeckLabel(uploads.neckLabel ?? createStandardNeckLabel());
      setSteps(
        stepsForConfiguration(
          resolvedColour.colour,
          uploads.artwork,
          uploads.neckLabel,
          restoredSteps
        )
      );
      setQuantity(
        safeQuantity(
            restoredQuantity,
            editCartId && editItemId
              ? 0
              : getProductMinimumOrderQuantity(productId, {
                colourType: resolvedColour.colour.type,
                customDyeMinimum: CUSTOM_DYE_MOQ_UNITS,
              })
        )
      );
      if (resolvedColour.wasObsolete) {
        setFeedback({
          tone: "error",
          title: "The saved garment colour is no longer available",
          detail: `We selected ${DEFAULT_COLOUR.name} instead. Historical orders remain unchanged.`,
        });
      }
      setDraftRestored(true);
    },
    [
      editCartId,
      editItemId,
      productId,
      setArtwork,
      setColour,
      setDraftRestored,
      setNeckLabel,
      setQuantity,
      setSteps,
    ]
  );

  const syncDraftToCloud = useCallback(
    async (
      draft: BuildDraft,
      options?: {
        interactive?: boolean;
        forceRevision?: number;
        createCopy?: boolean;
        title?: string;
      }
    ) => {
      pendingCloudSaveRef.current = { draft, options };
      if (cloudSaveInFlight.current) {
        setCloudSaveStatus("saving");
        setCloudMessage("Saving your latest changes…");
        return;
      }

      cloudSaveInFlight.current = true;
      try {
        while (pendingCloudSaveRef.current) {
          const pending = pendingCloudSaveRef.current;
          pendingCloudSaveRef.current = null;
          setCloudSaveStatus("saving");
          setCloudMessage(
            pending.options?.createCopy
              ? "Creating a saved copy…"
              : "Saving design and artwork securely…"
          );

          let result;
          try {
            result = await saveBuildDraftToCloud({
              configId,
              storageKey: designStorageKey,
              productName,
              draft: pending.draft,
              existingLink: cloudLinkRef.current,
              forceRevision: pending.options?.forceRevision,
              createCopy: pending.options?.createCopy,
              title: pending.options?.title,
            });
          } catch {
            pendingCloudSaveRef.current = null;
            setCloudSaveStatus("error");
            setCloudMessage(
              "This browser draft is safe, but cloud save could not connect."
            );
            return;
          }

          if (result.ok) {
            setActiveCloudLink(result.link);
            setCloudConflict(null);
            if (pending.options?.interactive) {
              setFeedback({
                tone: "success",
                title: pending.options.createCopy
                  ? "Saved copy created"
                  : "Design saved to your account",
                detail:
                  "Your browser draft remains available as a fallback, and this design can now be resumed from another device.",
              });
            }
            if (!pendingCloudSaveRef.current) {
              setCloudSaveStatus("saved");
              setCloudMessage("Saved to your account");
            }
            continue;
          }

          pendingCloudSaveRef.current = null;
          if (result.kind === "conflict") {
            setCloudConflict(result.conflict);
            setCloudSaveStatus("conflict");
            setCloudMessage("This design changed on another device.");
            return;
          }

          setCloudSaveStatus("error");
          setCloudMessage(result.message);
          if (result.kind === "unauthorized" && pending.options?.interactive) {
            const titleParam = pending.options.title
              ? `&saveTitle=${encodeURIComponent(pending.options.title)}`
              : "";
            const next = `/configurator/build/${encodeURIComponent(configId)}?draftId=${encodeURIComponent(requestedDraftId ?? configId)}&cloudSave=1${titleParam}`;
            router.push(`/login?next=${encodeURIComponent(next)}`);
          }
          return;
        }
      } finally {
        cloudSaveInFlight.current = false;
      }
    },
    [
      configId,
      designStorageKey,
      productName,
      requestedDraftId,
      router,
      setActiveCloudLink,
    ]
  );

  async function handleSaveToAccount() {
    if (!savedDesignsEnabled) return;
    if (!cloudLinkRef.current) {
      if (!customerSession.email) {
        writeBuildDraft(designStorageKey, {
          colour,
          artwork,
          neckLabel,
          steps,
          quantity,
        });
        setAuthIntent("save-design");
        setAuthDialogOpen(true);
        return;
      }
      setDesignTitle(`${productName} — ${colour.name} — ${quantity} pcs`);
      setNameDialogOpen(true);
      return;
    }
    const draft = currentBuildDraft();
    writeBuildDraft(designStorageKey, {
      colour: draft.colour,
      artwork: draft.artwork,
      neckLabel: draft.neckLabel,
      steps: draft.steps,
      quantity: draft.quantity,
    });
    await syncDraftToCloud(draft, { interactive: true });
  }

  async function handleNamedSave() {
    const draft = currentBuildDraft();
    writeBuildDraft(designStorageKey, {
      colour: draft.colour,
      artwork: draft.artwork,
      neckLabel: draft.neckLabel,
      steps: draft.steps,
      quantity: draft.quantity,
    });
    setNameDialogOpen(false);
    await syncDraftToCloud(draft, {
      interactive: true,
      title: designTitle.trim() || `${productName} design`,
    });
  }

  async function handleUseThisDevice() {
    if (!cloudConflict) return;
    await syncDraftToCloud(currentBuildDraft(), {
      interactive: true,
      forceRevision: cloudConflict.draftRevision,
    });
  }

  async function handleUseCloudVersion() {
    if (!cloudConflict || !cloudLinkRef.current) return;
    setCloudSaveStatus("saving");
    setCloudMessage("Restoring the saved version…");
    const restored = await cloudSnapshotToBuildDraft(cloudConflict.snapshot);
    await applyRestoredConfiguration(
      restored.colour,
      restored.artwork,
      restored.neckLabel,
      restored.quantity,
      restored.steps
    );
    const nextLink: CloudDesignLink = {
      ...cloudLinkRef.current,
      draftRevision: cloudConflict.draftRevision,
      currentVersion: cloudConflict.currentVersion,
      lastSavedAt: cloudConflict.lastSavedAt,
    };
    setActiveCloudLink(nextLink);
    setCloudConflict(null);
    setCloudSaveStatus("saved");
    setCloudMessage("Saved version restored");
  }

  async function handleCreateCloudCopy() {
    if (!cloudConflict) return;
    await syncDraftToCloud(currentBuildDraft(), {
      interactive: true,
      createCopy: true,
    });
  }

  useEffect(() => {
    if (!draftRestored) return;
    const timer = window.setTimeout(() => setDraftRestored(false), 6000);
    return () => window.clearTimeout(timer);
  }, [draftRestored]);

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
    const timer = window.setTimeout(() => {
      const preferredQuantity = readPreferredQuantity();
      if (preferredQuantity) {
        setQuantity((current) =>
          current === getProductMinimumOrderQuantity(productId)
            ? safeQuantity(preferredQuantity, minimumQuantity)
            : current
        );
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [minimumQuantity, productId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (editCartId && editItemId) {
        const item = readDraft(editCartId).items.find((candidate) => candidate.id === editItemId);
        if (item && item.productId === productId) {
          restoredSizeQuantitiesRef.current = { ...item.sizeQuantities };
          await applyRestoredConfiguration(
            item.colour,
            item.artwork,
            item.neckLabel,
            totalUnits(item.sizeQuantities)
          );
          hasHydrated.current = true;
          setHydrationComplete(true);
          return;
        }
      }

      const localDraft = readBuildDraft(designStorageKey);
      const storedLink = readCloudDesignLink(designStorageKey);
      const targetDesignId = requestedDesignId ?? storedLink?.designId;

      if (targetDesignId) {
        const cloud = await loadCloudDesign(targetDesignId);
        if (cancelled) return;

        if (cloud.ok) {
          if (cloud.design.draft_snapshot.configId !== configId) {
            throw new Error("Cloud design does not match this product");
          }

          const nextLink: CloudDesignLink = {
            designId: cloud.design.id,
            draftRevision: cloud.design.draft_revision,
            currentVersion: cloud.design.current_version,
            lastSavedAt: cloud.design.last_saved_at,
            uploadFileIds:
              storedLink?.designId === cloud.design.id
                ? storedLink.uploadFileIds
                : {},
          };
          setActiveCloudLink(nextLink);

          const localIsMeaningful = hasMeaningfulDraft(localDraft);
          const localSavedAt = localDraft
            ? new Date(localDraft.savedAt).getTime()
            : 0;
          const cloudSavedAt = new Date(
            cloud.design.last_saved_at
          ).getTime();
          const sameLinkedDesign =
            storedLink?.designId === cloud.design.id;
          const revisionChanged =
            sameLinkedDesign &&
            storedLink.draftRevision !== cloud.design.draft_revision;
          const localIsNewer =
            localIsMeaningful &&
            Number.isFinite(localSavedAt) &&
            Number.isFinite(cloudSavedAt) &&
            localSavedAt > cloudSavedAt + 1000;
          const unrelatedLocalDraft =
            Boolean(requestedDesignId) &&
            localIsMeaningful &&
            !sameLinkedDesign;

          if (
            localDraft &&
            localIsMeaningful &&
            (revisionChanged || localIsNewer || unrelatedLocalDraft)
          ) {
            await applyRestoredConfiguration(
              localDraft.colour,
              localDraft.artwork,
              localDraft.neckLabel,
              localDraft.quantity,
              localDraft.steps
            );
            setCloudConflict({
              draftRevision: cloud.design.draft_revision,
              lastSavedAt: cloud.design.last_saved_at,
              snapshot: cloud.design.draft_snapshot,
              title: cloud.design.title,
              status: "draft",
              currentVersion: cloud.design.current_version,
            });
            setCloudSaveStatus("conflict");
            setCloudMessage(
              "This device and the cloud both have changes. Choose which to keep."
            );
          } else if (requestedDesignId || !localIsMeaningful) {
            const cloudDraft = await cloudSnapshotToBuildDraft(
              cloud.design.draft_snapshot
            );
            if (cancelled) return;
            await applyRestoredConfiguration(
              cloudDraft.colour,
              cloudDraft.artwork,
              cloudDraft.neckLabel,
              cloudDraft.quantity,
              cloudDraft.steps
            );
            setCloudSaveStatus("saved");
            setCloudMessage(
              "Saved version restored"
            );
          } else if (localDraft) {
            await applyRestoredConfiguration(
              localDraft.colour,
              localDraft.artwork,
              localDraft.neckLabel,
              localDraft.quantity,
              localDraft.steps
            );
            setCloudSaveStatus("saved");
            setCloudMessage(
              "Saved to your account"
            );
          }
        } else if (requestedDesignId && cloud.status === 401) {
          const next = `/configurator/build/${encodeURIComponent(configId)}?designId=${encodeURIComponent(requestedDesignId)}`;
          router.push(`/login?next=${encodeURIComponent(next)}`);
        } else {
          if (hasMeaningfulDraft(localDraft) && localDraft) {
            await applyRestoredConfiguration(
              localDraft.colour,
              localDraft.artwork,
              localDraft.neckLabel,
              localDraft.quantity,
              localDraft.steps
            );
          }
          setCloudSaveStatus("error");
          setCloudMessage(
            "Saved design access is unavailable. Your browser draft is still safe."
          );
        }
      } else if (hasMeaningfulDraft(localDraft) && localDraft) {
        await applyRestoredConfiguration(
          localDraft.colour,
          localDraft.artwork,
          localDraft.neckLabel,
          localDraft.quantity,
          localDraft.steps
        );
      }
      hasHydrated.current = true;
      setHydrationComplete(true);
    })().catch(() => {
      if (cancelled) return;
      hasHydrated.current = true;
      setHydrationComplete(true);
      setFeedback({ tone: "error", title: "Saved design could not be restored", detail: "The Studio opened with safe defaults. Re-upload any missing artwork and continue." });
    });

    return () => {
      cancelled = true;
    };
  }, [
    configId,
    designStorageKey,
    editCartId,
    editItemId,
    productId,
    requestedDesignId,
    applyRestoredConfiguration,
    router,
    setActiveCloudLink,
  ]);

  useEffect(() => {
    if (!hydrationComplete) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      const saved = writeBuildDraft(designStorageKey, { colour, artwork, neckLabel, steps, quantity });
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
        const savedDraft = readBuildDraft(designStorageKey);
        if (savedDraft && cloudLinkRef.current && !cloudConflict) {
          if (cloudSaveTimer.current) {
            window.clearTimeout(cloudSaveTimer.current);
          }
          cloudSaveTimer.current = window.setTimeout(() => {
            cloudSaveTimer.current = null;
            void syncDraftToCloud(savedDraft);
          }, 1400);
        }
      }
    }, 450);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      if (cloudSaveTimer.current) window.clearTimeout(cloudSaveTimer.current);
    };
  }, [
    designStorageKey,
    hydrationComplete,
    colour,
    artwork,
    neckLabel,
    steps,
    quantity,
    cloudConflict,
    syncDraftToCloud,
  ]);

  useEffect(() => {
    if (
      !hydrationComplete ||
      !requestedCloudSave ||
      cloudSaveIntentHandled.current
    ) {
      return;
    }
    cloudSaveIntentHandled.current = true;
    const draft: BuildDraft = {
      version: 1,
      savedAt: new Date().toISOString(),
      colour,
      artwork,
      neckLabel,
      steps,
      quantity,
    };
    writeBuildDraft(designStorageKey, {
      colour,
      artwork,
      neckLabel,
      steps,
      quantity,
    });
    void syncDraftToCloud(draft, {
      interactive: true,
      title: requestedSaveTitle || undefined,
    });
  }, [
    artwork,
    colour,
    designStorageKey,
    hydrationComplete,
    neckLabel,
    quantity,
    requestedCloudSave,
    requestedSaveTitle,
    steps,
    syncDraftToCloud,
  ]);

  function showCtaError(message: string) {
    setCtaErrorMessage(message);
    setCtaErrorNonce((previous) => previous + 1);
  }

  function setSafeQuantity(next: number) {
    setQuantity((current) => {
      const safe = safeQuantity(next, minimumQuantity);
      if (safe !== current) restoredSizeQuantitiesRef.current = null;
      return safe;
    });
  }

  function applyExpandedStepChange(next: AccordionStepId | null) {
    const wasLabel = expandedStepId === "neck-label";
    setExpandedStepId(next);
    setIsDrawerOpen(true);
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
        summary: `Signature · ${DEFAULT_COLOUR.name}`,
      });
    }
    if (stepId === "artwork") {
      setArtwork({});
      updateStep("artwork", { confirmed: false, skipped: false, summary: null });
    }
    if (stepId === "neck-label") {
      setNeckLabel(createStandardNeckLabel());
      setNeckLabelPreviewUrl(undefined);
      updateStep("neck-label", { confirmed: false, skipped: false, summary: null });
    }
  }

  async function commitConfigurationToCart(overrides?: {
    artwork?: Artwork;
    neckLabel?: NeckLabel;
  }, authenticatedJustNow = false) {
    if (catalogProductActive === false) {
      setFeedback({ tone: "error", title: "This product is no longer available", detail: "Choose an active product from the current catalogue." });
      return;
    }
    const cartArtwork = overrides?.artwork ?? artwork;
    const cartNeckLabel = overrides?.neckLabel ?? neckLabel;
    if (!authenticatedJustNow && customerSession.loading) {
      setFeedback({
        tone: "loading",
        title: "Preparing your cart…",
        detail: "Your configuration is ready while we check your account.",
      });
    }
    const authenticatedAfterRefresh =
      !authenticatedJustNow && customerSession.loading
        ? await customerSession.refresh()
        : false;
    if (!customerSession.email && !authenticatedAfterRefresh && !authenticatedJustNow) {
      writeBuildDraft(designStorageKey, {
        colour: { ...colour, confirmed: true },
        artwork: cartArtwork,
        neckLabel: cartNeckLabel,
        steps: stepsForConfiguration(
          { ...colour, confirmed: true },
          cartArtwork,
          cartNeckLabel,
          steps,
        ),
        quantity,
      });
      pendingCartCommitRef.current = () => commitConfigurationToCart(overrides, true);
      if (!accountsEnabled) {
        setFeedback({ tone: "error", title: "Sign in is required before adding to cart", detail: "Configured carts are securely owned by your customer account." });
      } else {
        setFeedback(null);
        setAuthIntent("add-to-cart");
        setAuthDialogOpen(true);
      }
      return;
    }

    const existingDraft = editCartId ? readDraft(editCartId) : null;
    if (editCartId && !editItemId && existingDraft && existingDraft.items.length >= MAX_CONFIGURED_CART_ITEMS) {
      setFeedback({
        tone: "error",
        title: "This cart already has 20 configured products",
        detail: "Remove a cart line or complete this order before adding another product.",
      });
      return;
    }
    const cartInput: ConfiguredCartItemInput = {
      productId,
      productName,
      previewImage: product?.defaultImage ?? flatlayAssetPath("regulartee.png"),
      colour: { ...colour, confirmed: true },
      artwork: cartArtwork,
      neckLabel:
        !isCustomNeckLabel(cartNeckLabel) || cartNeckLabel?.fileUrl || cartNeckLabel?.fileId
          ? cartNeckLabel
          : undefined,
      quantity,
      sizeQuantities:
        restoredSizeQuantitiesRef.current &&
        totalUnits(restoredSizeQuantitiesRef.current) === quantity
          ? restoredSizeQuantitiesRef.current
          : undefined,
      rushDelivery: false,
    };
    setFeedback({ tone: "loading", title: editItemId ? "Updating your configuration…" : "Adding configuration to cart…", detail: "Checking your design, quantity and price before opening sizes." });

    try {
      const storageKey = editItemId ? `cart-item:${editItemId}` : designStorageKey;
      const serverCartResult = resolveConfiguredCart({
        cartId: editCartId && existingDraft?.serverCartId === editCartId ? editCartId : undefined,
        email: customerSession.email ?? undefined,
      }).then(
        (cart) => ({ cart, error: null }),
        (error: unknown) => ({ cart: null, error }),
      );
      const cloudResult = await saveBuildDraftToCloud({
        configId,
        storageKey,
        productName,
        draft: {
          version: 1,
          savedAt: new Date().toISOString(),
          colour: cartInput.colour,
          artwork: cartInput.artwork,
          neckLabel: cartInput.neckLabel ?? createStandardNeckLabel(),
          steps,
          quantity,
        },
        existingLink: cloudLinkRef.current ?? readCloudDesignLink(storageKey),
      });
      if (!cloudResult.ok) {
        if (cloudResult.kind === "unauthorized") {
          writeBuildDraft(designStorageKey, {
            colour: cartInput.colour,
            artwork: cartInput.artwork,
            neckLabel: cartInput.neckLabel ?? createStandardNeckLabel(),
            steps,
            quantity,
          });
          pendingCartCommitRef.current = () => commitConfigurationToCart(overrides, true);
          setAuthIntent("add-to-cart");
          setAuthDialogOpen(true);
          setFeedback(null);
          return;
        }
        throw new Error(cloudResult.kind === "conflict" ? "This design changed in another session. Resolve the saved design before adding it." : cloudResult.message);
      }

      const resolvedServerCart = await serverCartResult;
      if (resolvedServerCart.error) throw resolvedServerCart.error;
      const serverCart = resolvedServerCart.cart;
      if (!serverCart) throw new Error("The Medusa cart could not be resolved.");
      const sizeQuantities = cartInput.sizeQuantities ?? splitQuantityAcrossSizes(quantity, product?.sizes ?? SIZES);
      const existingItem = editItemId ? existingDraft?.items.find((item) => item.id === editItemId) : undefined;
      const canonical = editItemId && existingItem?.medusaLineId
        ? await updateConfiguredLine({
            lineId: existingItem.medusaLineId,
            versionId: cloudResult.link.currentVersionId,
            quantity,
            sizes: sizeQuantities,
            deliveryType: "standard",
          })
        : await addConfiguredLine({
            cartId: serverCart.cartId,
            projectId: cloudResult.link.designId,
            versionId: cloudResult.link.currentVersionId,
            quantity,
            sizes: sizeQuantities,
            deliveryType: "standard",
          });
      const canonicalCart = canonical.cart;
      const canonicalLine = canonicalCart.lines.find((line) =>
        editItemId && existingItem?.medusaLineId
          ? line.id === existingItem.medusaLineId
          : line.projectId === cloudResult.link.designId,
      );
      const itemId = existingItem?.id ?? crypto.randomUUID();
      const syncedItem = {
        ...cartInput,
        id: itemId,
        medusaLineId: canonicalLine?.id ?? String((canonical.line as Record<string, unknown>).id ?? ""),
        designProjectId: cloudResult.link.designId,
        designVersionId: cloudResult.link.currentVersionId,
        sizeQuantities: canonicalLine?.sizeBreakdown as typeof sizeQuantities ?? sizeQuantities,
        unitPrice: (canonicalLine?.pricing ?? canonical.pricing).unitPricePaise / 100,
        backendPricing: canonicalLine?.pricing ?? canonical.pricing,
        plannedQuantity: undefined,
      };
      const previous = existingDraft ?? { ...readDraft(serverCart.cartId), items: [] };
      const nextItems = editItemId
        ? previous.items.map((item) => item.id === editItemId ? syncedItem : item)
        : [...previous.items, syncedItem];
      const nextDraft = {
        ...previous,
        items: nextItems,
        serverCartId: canonicalCart.cartId,
        backendCart: canonicalCart,
      };
      if (!writeDraft(canonicalCart.cartId, nextDraft)) throw new Error("Your browser could not save the synchronized cart.");
      if (requestedEstimateId && cloudLinkRef.current) writeEstimateForDesign(cloudLinkRef.current.designId, requestedEstimateId);
      clearBuildDraft(designStorageKey);
      router.push(`/configurator/cart/${encodeURIComponent(canonicalCart.cartId)}/review`);
    } catch (error) {
      setFeedback({
        tone: "error",
        title: "Could not synchronize this configuration",
        detail: error instanceof Error ? error.message : "Medusa could not accept this configuration. Your local draft is still open.",
      });
    }
  }

  function addConfigurationToCart(overrides?: { artwork?: Artwork; neckLabel?: NeckLabel }) {
    void commitConfigurationToCart(overrides);
  }

  const resumeAfterAuthentication = useEffectEvent(
    (intent: ConfiguratorAuthResumeIntent | null) => {
      router.replace(
        configuratorPathWithoutAuthResume(configId, searchParams.toString()),
      );
      if (!intent) {
        setFeedback({
          tone: "error",
          title: "Sign in could not be confirmed",
          detail: "Your configuration is still here. Sign in and try adding it again.",
        });
        return;
      }
      if (intent === "add-to-cart") {
        setFeedback({
          tone: "loading",
          title: editItemId
            ? "Updating your configuration…"
            : "Adding configuration to cart…",
          detail: "Your account is ready. Checking your design and price before opening sizes.",
        });
        void commitConfigurationToCart(undefined, true);
        return;
      }
      setDesignTitle(`${productName} — ${colour.name} — ${quantity} pcs`);
      setNameDialogOpen(true);
    },
  );

  useEffect(() => {
    if (
      !requestedAuthResume ||
      !hydrationComplete ||
      customerSession.loading ||
      authResumeHandledRef.current
    ) {
      return;
    }
    authResumeHandledRef.current = true;
    const intent = customerSession.email ? requestedAuthResume : null;
    const timer = window.setTimeout(
      () => resumeAfterAuthentication(intent),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [
    configId,
    customerSession.email,
    customerSession.loading,
    hydrationComplete,
    requestedAuthResume,
    router,
    searchParams,
  ]);

  function handleCtaClick() {
    setCtaErrorMessage(null);

    if (expandedStepId === "garment-colour") {
      if (!colour.name) {
        showCtaError("Choose a garment colour to continue.");
        return;
      }
      if (customDyeQuantityShortfall) {
        showCtaError(`Custom colour requires at least ${minimumQuantity} pieces.`);
        return;
      }
      const confirmedColour = { ...colour, confirmed: true };
      setColour(confirmedColour);
      updateStep("garment-colour", {
        confirmed: true,
        skipped: false,
        summary: `${confirmedColour.type === "signature" ? "Signature" : "Custom dye"} · ${confirmedColour.name}`,
      });
      setActiveView("front");
      applyExpandedStepChange("artwork");
      return;
    }

    if (expandedStepId === "artwork") {
      const hasArtwork = Boolean(artwork.front || artwork.back);
      if (!hasArtwork) {
        updateStep("artwork", {
          confirmed: true,
          skipped: true,
          summary: "No artwork added",
        });
        applyExpandedStepChange("neck-label");
        return;
      }
      const missingTechnique = (["front", "back"] as const).find(
        (side) => artwork[side]?.fileUrl && !artwork[side]?.technique
      );
      if (missingTechnique) {
        showCtaError(
          `Choose a print method for the ${missingTechnique} artwork before continuing.`
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
      if (returnToSizeQuantity && editCartId && editItemId) {
        addConfigurationToCart({ artwork: readyArtwork });
        return;
      }
      applyExpandedStepChange("neck-label");
      return;
    }

    if (expandedStepId === "neck-label") {
      if (!isCustomNeckLabel(neckLabel)) {
        const readyStandardLabel = {
          ...createStandardNeckLabel(),
          confirmed: true,
        };
        updateStep("neck-label", {
          confirmed: true,
          skipped: false,
          summary: "Standard size label",
        });
        setNeckLabel(readyStandardLabel);
        addConfigurationToCart({ neckLabel: readyStandardLabel });
        return;
      }
      if (!neckLabel?.fileUrl && !neckLabel?.fileId) {
        showCtaError(`Upload your ${isToteProduct ? "bag" : "neck label"} artwork before continuing.`);
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
    try {
      const sizes = product?.sizes ?? ["XS", "S", "M", "L", "XL", "XXL"];
      const sizeQuantities = splitQuantityAcrossSizes(quantity, sizes);
      const pricing = getConfiguredPricingSummary(
        productId,
        colour,
        artwork,
        neckLabel,
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
      const { generateApprovalPdf } = await import("@/lib/configurator/approvalPdf");
      await generateApprovalPdf({
        projectReference: configId,
        documentTitle: "Merch Design Summary",
        items: [
          {
            id: configId,
            productName,
            previewImage: product?.defaultImage ?? flatlayAssetPath("regulartee.png"),
            colour,
            artwork,
            neckLabel,
            sizeQuantities,
            unitPrice: pricing.discountedUnitPrice,
          },
        ],
        totals: {
          subtotal: pricing.lineSubtotal,
          volumeDiscount: pricing.discountAmount,
          gst: pricing.gst,
          total: pricing.total,
        },
        previewDataUrls: { [configId]: previewDataUrl },
        filename: `Garmops-Design-${configId}.pdf`,
      });
      setFeedback({ tone: "success", title: "Design PDF downloaded", detail: "The document is a dated snapshot of this configuration." });
    } catch {
      setFeedback({ tone: "error", title: "PDF generation failed", detail: "Your configuration is safe. Check your connection and try downloading again.", retryPdf: true });
    } finally {
      setIsDownloadingPdf(false);
    }
  }

  return (
    <ArtworkPositionProvider activeView={activeView}>
      {!hydrationComplete ? (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-(--color-cream)">
          <GarmopsLoadingScreen
            progress={configuratorLoadProgress}
            statusText={configuratorLoadingStatus}
            description="Restoring your saved selections. The workspace will open while the garment preview finishes loading."
          />
        </div>
      ) : null}
      <div
        className="techpack-studio-bg flex h-dvh min-h-0 flex-col overflow-hidden text-(--text-primary)"
        data-configurator-hydrated={hydrationComplete ? "true" : "false"}
        data-configurator-ready={configuratorOpened ? "true" : "false"}
        aria-hidden={!hydrationComplete}
        inert={!hydrationComplete}
      >
        <ConfiguratorTopBar
          currentStep={JOURNEY_STEP_FOR_CUSTOMISATION[activeCustomisationStepId]}
          backHref={editCartId
            ? `/configurator/cart/${encodeURIComponent(editCartId)}/review`
            : productCatalogHref}
          onDownloadPdf={handleDownloadPdf}
          isDownloadingPdf={isDownloadingPdf}
          showCart
          productName={productName}
          specReference={
            editItemId
              ? `ITEM-${editItemId}`
              : cloudLink?.designId || requestedDesignId
                ? `DESIGN-${cloudLink?.designId ?? requestedDesignId}`
                : undefined
          }
          accountSaveNotice={savedDesignsEnabled ? (
            <div
              role="status"
              aria-live="polite"
              className={`hidden min-w-0 max-w-[42vw] items-center gap-2 text-xs md:flex ${
                cloudSaveStatus === "conflict"
                  ? "text-amber-950"
                  : cloudSaveStatus === "error"
                    ? "text-rose-900"
                    : "text-(--color-accent)"
              }`}
            >
              {cloudSaveStatus === "saving" ? (
                <LoaderCircle size={15} className="shrink-0 animate-spin" aria-hidden="true" />
              ) : cloudSaveStatus === "conflict" || cloudSaveStatus === "error" ? (
                <CloudAlert size={15} className="shrink-0" aria-hidden="true" />
              ) : (
                <Cloud size={15} className="shrink-0" aria-hidden="true" />
              )}
              <span className="hidden min-w-0 flex-1 truncate font-medium md:block">{cloudMessage}</span>

              {cloudSaveStatus === "conflict" ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <button type="button" onClick={handleUseThisDevice} className="rounded-sm bg-(--color-accent) px-3 py-1.5 font-semibold text-white hover:bg-(--color-accent-dark)">Use this device</button>
                  <button type="button" onClick={handleUseCloudVersion} className="rounded-sm border border-amber-900/20 bg-white/70 px-3 py-1.5 font-semibold hover:bg-white">Use saved version</button>
                  <button type="button" onClick={handleCreateCloudCopy} className="rounded-sm border border-amber-900/20 bg-white/70 px-3 py-1.5 font-semibold hover:bg-white">Create a copy</button>
                </div>
              ) : cloudSaveStatus !== "saving" ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  {cloudLink ? (
                    <button type="button" onClick={() => router.push(`/account/designs/${encodeURIComponent(cloudLink.designId)}`)} className="rounded-sm border border-(--color-accent)/20 bg-white/70 px-3 py-1.5 font-semibold hover:bg-white">View saved design</button>
                  ) : null}
                  <button type="button" onClick={handleSaveToAccount} className="rounded-sm bg-(--color-accent) px-3 py-1.5 font-semibold text-white hover:bg-(--color-accent-dark)">
                    {cloudLink ? "Save now" : "Save design"}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          links={{ product: productCatalogHref }}
          onStepSelect={journeyStepSelection}
          className="px-4"
        />

        {nameDialogOpen ? (
          <div className="fixed inset-0 z-[75] flex items-center justify-center bg-(--color-navy)/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setNameDialogOpen(false); }}>
            <div className="w-full max-w-md rounded-sm border border-black/10 bg-white p-6" role="dialog" aria-modal="true" aria-labelledby="save-design-title">
              <h2 id="save-design-title" className="text-xl font-semibold">Save design</h2>
              <p className="mt-2 text-sm text-black/55">Give this design a name so you can find it later.</p>
              <label htmlFor="design-name" className="mt-5 block text-sm font-medium">Design name</label>
              <input id="design-name" autoFocus value={designTitle} onChange={(event) => setDesignTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void handleNamedSave(); }} maxLength={160} className="mt-2 w-full rounded border border-black/15 px-3 py-2.5 outline-none focus:border-(--color-accent)" />
              <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setNameDialogOpen(false)} className="rounded border border-black/10 px-4 py-2 text-sm">Cancel</button><button type="button" onClick={() => void handleNamedSave()} className="rounded bg-(--color-accent) px-4 py-2 text-sm font-semibold text-white">Save design</button></div>
            </div>
          </div>
        ) : null}

        {accountsEnabled && authDialogOpen ? (
          <CustomerAuthDialog
            open={authDialogOpen}
            title={authIntent === "add-to-cart" ? "Sign in to continue" : "Sign in to save your design"}
            description={authIntent === "add-to-cart" ? "Sign in to secure this design and continue to sizes. Your work is already saved on this device." : "Sign in to save this design to your account and access it on another device."}
            onClose={() => {
              setAuthDialogOpen(false);
              setAuthIntent(null);
              pendingCartCommitRef.current = null;
            }}
            next={configuratorAuthReturnPath(
              configId,
              searchParams.toString(),
              activeCustomisationStepId,
              authIntent ?? "save-design",
            )}
            onAuthenticated={() => {
              const completedIntent = authIntent;
              setAuthDialogOpen(false);
              setAuthIntent(null);
              void customerSession.refresh();
              const pending = pendingCartCommitRef.current;
              pendingCartCommitRef.current = null;
              if (completedIntent === "add-to-cart" && pending) {
                void pending();
              } else {
                setDesignTitle(`${productName} — ${colour.name} — ${quantity} pcs`);
                setNameDialogOpen(true);
              }
            }}
          />
        ) : null}

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
            neckLabelPreviewUrl={neckLabelPreviewUrl}
            interactive={false}
              exclusiveLayerCache
              className="h-full w-full bg-[#F7F7F7]"
            />
          </ArtworkPositionProvider>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto px-4 pb-20 lg:grid-cols-[minmax(0,1fr)_clamp(360px,34vw,420px)] lg:overflow-hidden lg:px-5 lg:pb-5 xl:grid-cols-[minmax(0,1fr)_440px]">
          <main className="relative flex min-h-[72dvh] min-w-0 flex-col bg-(--color-studio-bg) lg:min-h-0">
            <div
              data-configurator-preview="true"
              className="flex min-h-0 flex-1 items-center justify-center"
            >
              <GarmentPreview
                activeView={activeView}
                onViewChange={setActiveView}
                colourHex={colour.hex}
                productId={productId}
                artwork={artwork}
                neckLabel={previewNeckLabel}
                neckLabelPreviewUrl={neckLabelPreviewUrl}
                hideBackView={activeCustomisationStepId === "neck-label"}
                showProductionGuides={activeCustomisationStepId === "artwork"}
                exclusiveLayerCache
                onGarmentRenderProgress={handleGarmentRenderProgress}
                previewPending={!activePreviewSettled}
              />
            </div>

            <div
              className="absolute right-4 top-4 z-30 lg:bottom-4 lg:top-auto"
            >
              <WhatsAppAssistantBar configId={configId} productName={productName} />
            </div>
          </main>

          <aside className="fixed inset-x-2 bottom-0 z-50 flex max-h-[calc(100dvh-5rem)] min-w-0 flex-col gap-2 overflow-y-auto rounded-t-md bg-(--color-studio-bg) p-1.5 pb-[max(.5rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(22,33,43,0.14)] lg:static lg:z-auto lg:min-h-0 lg:max-h-none lg:flex-col lg:gap-3 lg:overflow-hidden lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none">
            <section
              aria-label="Active customisation controls"
              className={`techpack-stack techpack-surface flex shrink-0 flex-col overflow-hidden rounded-md border-(--color-control-border)! bg-white! border transition-[height] duration-250 ease-[cubic-bezier(.22,1,.36,1)] lg:min-h-0 lg:flex-1 ${
                isDrawerOpen ? "h-[min(42dvh,390px)]" : "h-14"
              } lg:h-auto`}
            >
              <button
                type="button"
                onClick={() => setIsDrawerOpen((open) => !open)}
                aria-expanded={isDrawerOpen}
                aria-controls="customisation-drawer-content"
                className="flex h-14 shrink-0 items-center justify-between gap-3 px-4 text-left hover:bg-white/30 lg:hidden"
              >
                <span className="min-w-0 truncate text-sm font-medium text-(--text-primary)">
                  {activeDrawerStepLabel}
                  <span className="font-normal text-(--text-primary)/50">
                    {" · "}
                    {activeDrawerStep.summary ?? "Not added yet"}
                  </span>
                </span>
                <ChevronUp
                  size={17}
                  strokeWidth={2.2}
                  aria-hidden="true"
                  className={`shrink-0 transition-transform duration-300 ${
                    isDrawerOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              <div
                id="customisation-drawer-content"
                className={`min-h-0 flex-1 flex-col overflow-hidden transition-opacity duration-200 ${
                  isDrawerOpen ? "flex opacity-100" : "hidden opacity-0 lg:flex lg:opacity-100"
                }`}
              >
                <div className="min-h-0 flex-1">
                  <ConfiguratorSidebar
                    productId={productId}
                    expandedStepId={expandedStepId}
                    selectedColour={colour}
                    onColourChange={(next) => {
                      const pendingColour = { ...next, confirmed: false };
                      setColour(pendingColour);
                      updateStep("garment-colour", {
                        confirmed: false,
                        skipped: false,
                        summary: `${next.type === "signature" ? "Signature" : "Custom dye"} · ${next.name}`,
                      });
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
                    onNeckLabelPreviewChange={setNeckLabelPreviewUrl}
                    activeView={activeView}
                    onViewChange={setActiveView}
                    unitBasePrice={unitBasePrice}
                    quantity={quantity}
                    minimumQuantity={customDyeMinimumQuantity}
                    onQuantityChange={setSafeQuantity}
                    isToteProduct={isToteProduct}
                    onResetStep={resetStepDraft}
                    activeStepSummary={activeControlSummary}
                    draftRestored={draftRestored}
                    onDismissDraftRestored={() => setDraftRestored(false)}
                  />
                </div>
              </div>
            </section>

            <div className="shrink-0">
              <OrderBar
                quantity={quantity}
                onQuantityChange={setSafeQuantity}
                minQuantity={minimumQuantity}
                ctaLabel={
                  returnToSizeQuantity && expandedStepId === "artwork"
                    ? "Return to sizes & quantity →"
                    : accountsEnabled && !customerSession.loading && !customerSession.email && expandedStepId === "neck-label"
                      ? "Sign in to continue to sizes →"
                    : getConfiguratorCtaLabel(expandedStepId, {
                        hasArtwork: Boolean(artwork.front || artwork.back),
                        hasCustomLabel: isCustomNeckLabel(neckLabel),
                        isToteProduct,
                      })
                }
                onCtaClick={handleCtaClick}
                pricingBreakdown={orderBarPricing}
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
