"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronUp, Cloud, CloudAlert, LoaderCircle } from "lucide-react";
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
import { ConfiguratorTopBar } from "./ConfiguratorTopBar";
import type { ConfiguratorJourneyStep } from "./ConfiguratorJourney";
import { WhatsAppAssistantBar } from "./WhatsAppAssistantBar";
import { ArtworkPositionProvider } from "@/lib/configurator/ArtworkPositionContext";
import { getProduct } from "@/lib/configurator/products";
import {
  getBasePrice,
  buildPricingBreakdown,
  getConfiguredPricingSummary,
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
  type BuildDraft,
} from "@/lib/configurator/buildDraft";
import {
  restoreConfigurationUploads,
  revokeObjectUrl,
} from "@/lib/configurator/objectUrls";
import { generateApprovalPdf } from "@/lib/configurator/approvalPdf";
import { RESERVATION_FEE } from "@/lib/configurator/reservation";
import { ActionFeedback, type ActionFeedbackTone } from "./ActionFeedback";
import { trackConfiguratorEvent } from "@/lib/configurator/analytics";
import { getDeliveryFeasibility } from "@/lib/configurator/deliveryFeasibility";
import {
  readPreferredQuantity,
  readPreferredTargetDate,
  writePreferredTargetDate,
} from "@/lib/configurator/clientPreferences";
import {
  cloudSnapshotToBuildDraft,
  loadCloudDesign,
  readCloudDesignLink,
  saveBuildDraftToCloud,
  writeCloudDesignLink,
  type CloudDesignLink,
  type CloudSaveConflict,
} from "@/lib/designs/client";


interface FeedbackState {
  tone: ActionFeedbackTone;
  title: string;
  detail?: string;
  retryPdf?: boolean;
}

interface ConfigureClientProps {
  configId: string;
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

const FALLBACK_PRODUCT_ID = "regular-fit-tee-200gsm";
const JOURNEY_STEP_FOR_CUSTOMISATION: Record<AccordionStepId, ConfiguratorJourneyStep> = {
  "garment-colour": "colour",
  artwork: "artwork",
  "neck-label": "neck-label",
};

function safeQuantity(value: unknown, minimum = 50): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.floor(parsed)) : minimum;
}

function artworkSummary(artwork: Artwork): string | null {
  const summary = [
    artwork.front?.technique && `Front · ${TECHNIQUE_LABELS[artwork.front.technique]}`,
    artwork.back?.technique && `Back · ${TECHNIQUE_LABELS[artwork.back.technique]}`,
  ]
    .filter(Boolean)
    .join(", ");
  return summary || null;
}

function labelSummary(neckLabel?: NeckLabel): string | null {
  if (
    (!neckLabel?.fileUrl && !neckLabel?.fileId) ||
    !neckLabel.dimensions ||
    !neckLabel.position
  ) return null;
  return `${neckLabel.dimensions.replace("x", " × ")} mm · ${POSITION_LABELS[neckLabel.position]}`;
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
    const summary = labelSummary(neckLabel);
    return {
      ...step,
      confirmed: restored?.confirmed ?? Boolean(summary),
      skipped: !summary && restored?.skipped === true,
      summary: summary ?? (restored?.skipped ? "Skipped · standard label only" : null),
    };
  });
}

function getCtaLabel(openStep: AccordionStepId | null): string {
  if (openStep === "garment-colour") return "Continue";
  if (openStep === "artwork") return "Continue";
  if (openStep === "neck-label") return "Continue to sizes";
  return "Continue to sizes";
}

export default function ConfigureClient({ configId }: ConfigureClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const product = getProduct(configId);
  const productId = product?.id ?? FALLBACK_PRODUCT_ID;
  const productName = product?.name ?? "Classic Tee";
  const editCartId = searchParams.get("cartId");
  const editItemId = searchParams.get("itemId");
  const requestedStepParam = searchParams.get("step");
  const requestedDesignId = searchParams.get("designId");
  const requestedCloudSave = searchParams.get("cloudSave") === "1";
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
  const [quantity, setQuantity] = useState(50);
  const [ctaErrorMessage, setCtaErrorMessage] = useState<string | null>(null);
  const [ctaErrorNonce, setCtaErrorNonce] = useState(0);
  const [colour, setColour] = useState<GarmentColour>(DEFAULT_COLOUR);
  const [artwork, setArtwork] = useState<Artwork>({});
  const [neckLabel, setNeckLabel] = useState<NeckLabel>({} as NeckLabel);
  const [steps, setSteps] = useState<AccordionStepState[]>(() =>
    stepsForConfiguration(DEFAULT_COLOUR, {}, undefined)
  );
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [draftRestored, setDraftRestored] = useState(false);
  const [hydrationComplete, setHydrationComplete] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [preferredTargetDate, setPreferredTargetDate] = useState("");
  const [cloudLink, setCloudLink] = useState<CloudDesignLink | null>(null);
  const [cloudSaveStatus, setCloudSaveStatus] =
    useState<CloudSaveStatus>("local");
  const [cloudMessage, setCloudMessage] = useState(
    "Save to your account for cross-device access."
  );
  const [cloudConflict, setCloudConflict] =
    useState<CloudSaveConflict | null>(null);
  const hasHydrated = useRef(false);
  const saveTimer = useRef<number | null>(null);
  const saveStatusTimer = useRef<number | null>(null);
  const autosaveErrorNotifiedRef = useRef(false);
  const retainedObjectUrlsRef = useRef<Set<string>>(new Set());
  const cloudLinkRef = useRef<CloudDesignLink | null>(null);
  const cloudSaveTimer = useRef<number | null>(null);
  const cloudSaveInFlight = useRef(false);
  const cloudSaveIntentHandled = useRef(false);

  const pricingBreakdown = buildPricingBreakdown(productId, colour, artwork, neckLabel, quantity);
  const minimumQuantity = colour.type === "custom_dye" ? CUSTOM_DYE_MOQ_UNITS : 50;
  const activeCustomisationStepId = expandedStepId ?? "garment-colour";
  const previewNeckLabel: NeckLabel =
    activeCustomisationStepId === "neck-label" && !neckLabel.fileUrl
      ? {
          ...neckLabel,
          fileUrl: "",
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
        : neckLabel?.fileUrl || neckLabel?.fileId
          ? `${isToteProduct ? "Bag" : "Neck"} label added`
          : activeDrawerStep.skipped
            ? `${isToteProduct ? "Bag" : "Neck"} label skipped`
            : `No ${isToteProduct ? "bag" : "neck"} label added`;
  const displayedSaveStatus =
    !hydrationComplete
      ? "restoring"
      : saveStatus === "saving"
        ? "saving"
        : saveStatus === "error"
          ? "error"
          : "saved";
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
      if (next) writeCloudDesignLink(configId, next);
    },
    [configId, setCloudLink]
  );

  const applyRestoredConfiguration = useCallback(
    async (
      restoredColour: GarmentColour,
      restoredArtwork: Artwork,
      restoredNeckLabel: NeckLabel | undefined,
      restoredQuantity: unknown,
      restoredSteps?: AccordionStepState[]
    ) => {
      const uploads = await restoreConfigurationUploads(
        restoredArtwork,
        restoredNeckLabel
      );
      setColour(restoredColour);
      setArtwork(uploads.artwork);
      setNeckLabel((uploads.neckLabel ?? {}) as NeckLabel);
      setSteps(
        stepsForConfiguration(
          restoredColour,
          uploads.artwork,
          uploads.neckLabel,
          restoredSteps
        )
      );
      setQuantity(
        safeQuantity(
          restoredQuantity,
          restoredColour.type === "custom_dye"
            ? CUSTOM_DYE_MOQ_UNITS
            : 50
        )
      );
      setDraftRestored(true);
    },
    [
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
      }
    ) => {
      if (cloudSaveInFlight.current) return;
      cloudSaveInFlight.current = true;
      setCloudSaveStatus("saving");
      setCloudMessage(
        options?.createCopy
          ? "Creating an independent cloud copy…"
          : "Saving design and artwork securely…"
      );

      let result;
      try {
        result = await saveBuildDraftToCloud({
          configId,
          productName,
          draft,
          existingLink: cloudLinkRef.current,
          forceRevision: options?.forceRevision,
          createCopy: options?.createCopy,
        });
      } catch {
        cloudSaveInFlight.current = false;
        setCloudSaveStatus("error");
        setCloudMessage(
          "This browser draft is safe, but cloud save could not connect."
        );
        return;
      }
      cloudSaveInFlight.current = false;

      if (result.ok) {
        setActiveCloudLink(result.link);
        setCloudConflict(null);
        setCloudSaveStatus("saved");
        setCloudMessage(
          `Cloud saved · version ${result.link.currentVersion}`
        );
        if (options?.interactive) {
          setFeedback({
            tone: "success",
            title: options.createCopy
              ? "Cloud copy created"
              : "Design saved to your account",
            detail:
              "Your browser draft remains available as a fallback, and this design can now be resumed from another device.",
          });
        }
        return;
      }

      if (result.kind === "conflict") {
        setCloudConflict(result.conflict);
        setCloudSaveStatus("conflict");
        setCloudMessage("A newer cloud draft needs your choice.");
        return;
      }

      setCloudSaveStatus("error");
      setCloudMessage(result.message);
      if (result.kind === "unauthorized" && options?.interactive) {
        const next = `/configurator/build/${encodeURIComponent(configId)}?cloudSave=1`;
        router.push(`/login?next=${encodeURIComponent(next)}`);
      }
    },
    [
      configId,
      productName,
      router,
      setActiveCloudLink,
      setCloudConflict,
      setCloudMessage,
      setCloudSaveStatus,
      setFeedback,
    ]
  );

  async function handleSaveToAccount() {
    const draft = currentBuildDraft();
    writeBuildDraft(configId, {
      colour: draft.colour,
      artwork: draft.artwork,
      neckLabel: draft.neckLabel,
      steps: draft.steps,
      quantity: draft.quantity,
    });
    await syncDraftToCloud(draft, { interactive: true });
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
    setCloudMessage("Restoring the cloud version…");
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
    setCloudMessage(`Cloud version ${nextLink.currentVersion} restored`);
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
      setPreferredTargetDate(readPreferredTargetDate());
      const preferredQuantity = readPreferredQuantity();
      if (preferredQuantity) {
        setQuantity((current) => current === 50 ? preferredQuantity : current);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
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
          setHydrationComplete(true);
          return;
        }
      }

      const localDraft = readBuildDraft(configId);
      const storedLink = readCloudDesignLink(configId);
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
              `Cloud version ${cloud.design.current_version} restored`
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
              `Cloud linked · version ${cloud.design.current_version}`
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
            "Cloud restore is unavailable. Your browser draft is still safe."
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
    editCartId,
    editItemId,
    productId,
    requestedDesignId,
    applyRestoredConfiguration,
    router,
    setActiveCloudLink,
  ]);

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
        const savedDraft = readBuildDraft(configId);
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
      if (saveStatusTimer.current) window.clearTimeout(saveStatusTimer.current);
      if (cloudSaveTimer.current) window.clearTimeout(cloudSaveTimer.current);
    };
  }, [
    configId,
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
    writeBuildDraft(configId, {
      colour,
      artwork,
      neckLabel,
      steps,
      quantity,
    });
    void syncDraftToCloud(draft, { interactive: true });
  }, [
    artwork,
    colour,
    configId,
    hydrationComplete,
    neckLabel,
    quantity,
    requestedCloudSave,
    steps,
    syncDraftToCloud,
  ]);

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

  function updatePreferredTargetDate(next: string) {
    setPreferredTargetDate(next);
    writePreferredTargetDate(next);
    trackConfiguratorEvent("target_date_selected", { target_date: next || null });
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
      previewImage: product?.defaultImage ?? "/flatlays/regulartee.png",
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
        summary: `${confirmedColour.type === "signature" ? "Signature" : "Custom dye"} · ${confirmedColour.name}`,
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
      if (!neckLabel?.fileUrl && !neckLabel?.fileId) {
        trackConfiguratorEvent("neck_label_skipped", {
          product_id: productId,
          step: "neck_label",
        });
        updateStep("neck-label", {
          confirmed: true,
          skipped: true,
          summary: "Skipped · standard label only",
        });
        addConfigurationToCart({ neckLabel: {} as NeckLabel });
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
            previewImage: product?.defaultImage ?? "/flatlays/regulartee.png",
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
      <div className="configurator-studio-bg flex h-dvh min-h-0 flex-col overflow-hidden text-[#111111]">
        <ConfiguratorTopBar
          currentStep={JOURNEY_STEP_FOR_CUSTOMISATION[activeCustomisationStepId]}
          backHref="/configurator"
          onDownloadPdf={handleDownloadPdf}
          isDownloadingPdf={isDownloadingPdf}
          showCart
          links={{ product: "/configurator" }}
          onStepSelect={journeyStepSelection}
          className="px-4"
        />

        <div className="px-4 pb-2 lg:px-5">
          <div
            role="status"
            aria-live="polite"
            className={`mx-auto flex max-w-[1480px] flex-wrap items-center gap-2 rounded-2xl border px-3 py-2 text-xs shadow-sm backdrop-blur-xl ${
              cloudSaveStatus === "conflict"
                ? "border-amber-300/70 bg-amber-50/90 text-amber-950"
                : cloudSaveStatus === "error"
                  ? "border-rose-200/80 bg-rose-50/90 text-rose-900"
                  : "border-white/75 bg-white/55 text-[#315F66]"
            }`}
          >
            {cloudSaveStatus === "saving" ? (
              <LoaderCircle
                size={15}
                className="shrink-0 animate-spin"
                aria-hidden="true"
              />
            ) : cloudSaveStatus === "conflict" ||
              cloudSaveStatus === "error" ? (
              <CloudAlert size={15} className="shrink-0" aria-hidden="true" />
            ) : (
              <Cloud size={15} className="shrink-0" aria-hidden="true" />
            )}
            <span className="min-w-0 flex-1 font-medium">{cloudMessage}</span>

            {cloudSaveStatus === "conflict" ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleUseThisDevice}
                  className="rounded-full bg-[#315F66] px-3 py-1.5 font-semibold text-white hover:bg-[#254b51]"
                >
                  Use this device
                </button>
                <button
                  type="button"
                  onClick={handleUseCloudVersion}
                  className="rounded-full border border-amber-900/20 bg-white/70 px-3 py-1.5 font-semibold hover:bg-white"
                >
                  Use cloud version
                </button>
                <button
                  type="button"
                  onClick={handleCreateCloudCopy}
                  className="rounded-full border border-amber-900/20 bg-white/70 px-3 py-1.5 font-semibold hover:bg-white"
                >
                  Create a copy
                </button>
              </div>
            ) : cloudSaveStatus !== "saving" ? (
              <div className="flex items-center gap-1.5">
                {cloudLink ? (
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/account/designs/${encodeURIComponent(cloudLink.designId)}`
                      )
                    }
                    className="rounded-full border border-[#315F66]/20 bg-white/70 px-3 py-1.5 font-semibold hover:bg-white"
                  >
                    View in account
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleSaveToAccount}
                  className="rounded-full bg-[#315F66] px-3 py-1.5 font-semibold text-white hover:bg-[#254b51]"
                >
                  {cloudLink ? "Save now" : "Save to account"}
                </button>
              </div>
            ) : null}
          </div>
        </div>

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
              exclusiveLayerCache
              className="h-full w-full bg-[#F7F7F7]"
            />
          </ArtworkPositionProvider>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto px-4 pb-20 lg:grid-cols-[minmax(0,1fr)_clamp(360px,34vw,420px)] lg:overflow-hidden lg:px-5 lg:pb-4 xl:grid-cols-[minmax(0,1fr)_440px]">
          <main className="relative flex min-h-[72dvh] min-w-0 flex-col overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_12px_34px_rgba(22,33,43,0.08)] ring-1 ring-black/5 lg:min-h-0">
            <div className="pointer-events-none absolute left-4 top-4 z-20 flex h-10 max-w-[calc(100%-2rem)] items-center gap-3 overflow-hidden rounded-full border border-white/65 bg-white/35 px-4 shadow-[0_8px_24px_rgba(22,33,43,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] ring-1 ring-black/5 backdrop-blur-2xl backdrop-saturate-150">
              <span
                aria-hidden="true"
                className="absolute inset-px rounded-full bg-gradient-to-b from-white/50 via-white/15 to-white/5"
              />
              <Image
                src="/logo3.png"
                alt="Garmops"
                width={908}
                height={114}
                className="relative z-10 h-3.5 w-auto shrink-0 object-contain"
              />
              <span
                aria-hidden="true"
                className="relative z-10 h-4 w-px shrink-0 bg-[#111111]/15"
              />
              <span className="relative z-10 truncate text-sm font-medium text-[#111111]/85">
                {productName}
              </span>
            </div>

            <div
              data-configurator-preview="true"
              className="flex min-h-0 flex-1 items-center justify-center overflow-hidden"
            >
              <GarmentPreview
                activeView={activeView}
                onViewChange={setActiveView}
                colourHex={colour.hex}
                productId={productId}
                artwork={artwork}
                neckLabel={previewNeckLabel}
                hideBackView={activeCustomisationStepId === "neck-label"}
                showProductionGuides={activeCustomisationStepId === "artwork"}
                exclusiveLayerCache
              />
            </div>

            <div
              className={`absolute right-4 z-30 transition-[bottom] duration-300 ease-in-out ${
                isDrawerOpen ? "bottom-[calc(42%+1rem)]" : "bottom-16"
              } lg:bottom-4`}
            >
              <WhatsAppAssistantBar configId={configId} productName={productName} />
            </div>
          </main>

          <aside className="contents lg:flex lg:min-h-0 lg:min-w-0 lg:flex-col lg:gap-3 lg:overflow-hidden">
            <section
              aria-label="Active customisation controls"
              className={`configurator-glass-stack configurator-glass-surface fixed inset-x-3 bottom-0 z-50 flex flex-col overflow-hidden rounded-t-2xl border border-b-0 transition-[height] duration-300 ease-in-out lg:static lg:z-auto lg:min-h-0 lg:flex-1 lg:rounded-[28px] lg:border-b ${
                isDrawerOpen ? "h-[42dvh]" : "h-14"
              } lg:h-auto`}
            >
              <button
                type="button"
                onClick={() => setIsDrawerOpen((open) => !open)}
                aria-expanded={isDrawerOpen}
                aria-controls="customisation-drawer-content"
                className="flex h-14 shrink-0 items-center justify-between gap-3 px-4 text-left hover:bg-white/30 lg:hidden"
              >
                <span className="min-w-0 truncate text-sm font-medium text-[#111111]">
                  {activeDrawerStepLabel}
                  <span className="font-normal text-[#111111]/50">
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
                aria-hidden={!isDrawerOpen}
                className={`flex min-h-0 flex-1 flex-col overflow-hidden transition-opacity duration-200 ${
                  isDrawerOpen ? "opacity-100" : "pointer-events-none opacity-0"
                } lg:pointer-events-auto lg:opacity-100`}
              >
                <div className="min-h-0 flex-1">
                  <ConfiguratorSidebar
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
                    activeStepSummary={activeControlSummary}
                    saveStatus={displayedSaveStatus}
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
                ctaLabel={getCtaLabel(expandedStepId)}
                onCtaClick={handleCtaClick}
                pricingBreakdown={pricingBreakdown}
                preferredTargetDate={preferredTargetDate}
                onPreferredTargetDateChange={updatePreferredTargetDate}
                deliveryFeasibility={deliveryFeasibility}
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
