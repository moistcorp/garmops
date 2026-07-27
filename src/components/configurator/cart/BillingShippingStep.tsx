"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  FileText,
  MapPin,
  ReceiptText,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { DeliveryDatePicker } from "@/components/configurator/cart/DeliveryDatePicker";
import {
  AddressForm,
  doesGstinMatchState,
  digitsOnly,
  isEmailValid,
  isGstinValid,
  isIndianPhoneValid,
  isWebsiteValid,
} from "@/components/configurator/cart/AddressForm";
import { CartSummarySidebar } from "@/components/configurator/cart/CartSummarySidebar";
import {
  ConfiguratorTopBar,
  getCartJourneyLinks,
} from "@/components/configurator/ConfiguratorTopBar";
import {
  INDUSTRIES,
  PROJECT_DEPARTMENTS,
  getProcurementMissingFields,
  type BillingInformation,
  type CompanyInformation,
  type ProjectContact,
  type ProjectPreferences,
  type ShippingInformation,
} from "./checkoutDetails";
import { calculateTotals, createDraft, readDraft, type CartDraft, writeDraft } from "./cartDraft";
import { formatDeliveryLabel, isDeliverySelectionValid } from "@/lib/configurator/delivery";
import { CUSTOM_DYE_EXTRA_LEAD_TIME_DAYS } from "@/lib/configurator/colours";
import { persistUploadedFile } from "@/lib/configurator/objectUrls";
import { trackConfiguratorEvent } from "@/lib/configurator/analytics";
import { ActionFeedback } from "@/components/configurator/ActionFeedback";

export interface BillingShippingStepProps {
  cartId: string;
}

const INPUT_CLASS =
  "w-full rounded-md border border-[#E5E5E5] bg-[#F7F7F7] px-3 py-2 text-sm text-[#111111] placeholder:text-[#111111]/40 focus:border-[var(--color-teal)] focus:outline-none";
const LABEL_CLASS = "mb-1 block text-xs font-medium text-[#111111]/70";
const PO_MAX_BYTES = 3 * 1024 * 1024;
const PO_TYPES = ["application/pdf", "image/jpeg", "image/png"];
function formatIndianPhone(value: string): string {
  let digits = digitsOnly(value);
  if (digits.startsWith("91") && digits.length > 10) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length > 10) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  return digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
}

function cleanGstin(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15);
}

const FIELD_ID_MAP: Record<string, string> = {
  "company.name": "company-name",
  "company.industry": "company-industry",
  "company.gstin": "company-gstin",
  "company.website": "company-website",
  "contact.firstName": "contact-first-name",
  "contact.lastName": "contact-last-name",
  "contact.email": "contact-email",
  "contact.phone": "contact-phone",
  "contact.department": "contact-department",
  "shipping.recipientName": "shipping-recipient",
  "billing.entity": "billing-entity",
  "billing.accountsPayableEmail": "billing-email",
  "billing.gstin": "billing-gstin",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function sectionHeading(
  icon: ReactNode,
  title: string,
  description: string
) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <span className="rounded-full bg-[var(--color-teal)]/10 p-2 text-[var(--color-teal-dark)]">
        {icon}
      </span>
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#111111]">{title}</h2>
        <p className="mt-1 text-xs leading-relaxed text-[#111111]/55">{description}</p>
      </div>
    </div>
  );
}

export function BillingShippingStep({ cartId }: BillingShippingStepProps) {
  const router = useRouter();
  const poInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<CartDraft>(() => createDraft(cartId));
  const [isDraftReady, setIsDraftReady] = useState(false);
  const [poUploadStatus, setPoUploadStatus] = useState<"idle" | "saving">("idle");
  const [poUploadError, setPoUploadError] = useState("");
  const [validationFeedback, setValidationFeedback] = useState<string | null>(null);
  const [storageSaveError, setStorageSaveError] = useState<string | null>(null);
  const formStartedRef = useRef(false);

  useEffect(() => {
    const loadDraft = window.setTimeout(() => {
      const savedDraft = readDraft(cartId);
      if (savedDraft.items.length === 0) {
        router.replace(`/configurator/cart/${encodeURIComponent(cartId)}/review`);
        return;
      }
      setDraft(savedDraft);
      setIsDraftReady(true);
    }, 0);

    return () => window.clearTimeout(loadDraft);
  }, [cartId, router]);

  const selectedDeliveryDate = useMemo(
    () => draft.selectedDeliveryDateIso ? new Date(draft.selectedDeliveryDateIso) : undefined,
    [draft.selectedDeliveryDateIso]
  );
  const totals = calculateTotals(draft.items, draft.deliveryType);
  const extraLeadTimeDays = draft.items.some((item) => item.colour.type === "custom_dye")
    ? CUSTOM_DYE_EXTRA_LEAD_TIME_DAYS.max
    : 0;
  const deliveryBaseDate = useMemo(
    () => draft.orderConfirmedDateIso ? new Date(draft.orderConfirmedDateIso) : undefined,
    [draft.orderConfirmedDateIso]
  );

  const markFormStarted = useCallback(() => {
    if (formStartedRef.current) return;
    formStartedRef.current = true;
    trackConfiguratorEvent("company_form_started", { cart_id: cartId });
  }, [cartId]);

  const persistCartDraft = useCallback((next: CartDraft) => {
    const saved = writeDraft(cartId, next);
    window.queueMicrotask(() => {
      setStorageSaveError(saved
        ? null
        : "This browser could not save the latest checkout changes. Keep this tab open and try again before continuing.");
    });
  }, [cartId]);

  const updateDraft = useCallback((patch: Partial<CartDraft>) => {
    markFormStarted();
    setDraft((previous) => {
      const next = { ...previous, ...patch };
      persistCartDraft(next);
      return next;
    });
  }, [markFormStarted, persistCartDraft]);

  const updateCompany = useCallback((companyInformation: CompanyInformation) => {
    markFormStarted();
    setDraft((previous) => {
      const previousCompany = previous.companyInformation;
      const previousBilling = previous.billingInformation;
      const billingInformation: BillingInformation = {
        ...previousBilling,
        entity:
          !previousBilling.entity.trim() || previousBilling.entity === previousCompany.name
            ? companyInformation.name
            : previousBilling.entity,
        gstin:
          !previousBilling.gstin.trim() || previousBilling.gstin === previousCompany.gstin
            ? companyInformation.gstin
            : previousBilling.gstin,
      };
      const next = { ...previous, companyInformation, billingInformation };
      persistCartDraft(next);
      return next;
    });
  }, [markFormStarted, persistCartDraft]);

  const updateContact = useCallback((projectContact: ProjectContact) => {
    markFormStarted();
    setDraft((previous) => {
      const oldName = `${previous.projectContact.firstName} ${previous.projectContact.lastName}`.trim();
      const nextName = `${projectContact.firstName} ${projectContact.lastName}`.trim();
      const shippingInformation = {
        ...previous.shippingInformation,
        recipientName:
          !previous.shippingInformation.recipientName.trim() ||
          previous.shippingInformation.recipientName === oldName
            ? nextName
            : previous.shippingInformation.recipientName,
      };
      const billingInformation = {
        ...previous.billingInformation,
        accountsPayableEmail:
          !previous.billingInformation.accountsPayableEmail.trim() ||
          previous.billingInformation.accountsPayableEmail === previous.projectContact.email
            ? projectContact.email
            : previous.billingInformation.accountsPayableEmail,
      };
      const next = { ...previous, projectContact, shippingInformation, billingInformation };
      persistCartDraft(next);
      return next;
    });
  }, [markFormStarted, persistCartDraft]);

  const updateShipping = useCallback((shippingInformation: ShippingInformation) => {
    updateDraft({ shippingInformation });
  }, [updateDraft]);

  const updateBilling = useCallback((billingInformation: BillingInformation) => {
    updateDraft({ billingInformation });
  }, [updateDraft]);

  const updatePreferences = useCallback((projectPreferences: ProjectPreferences) => {
    updateDraft({ projectPreferences });
  }, [updateDraft]);

  const deliveryLabel = useMemo(
    () => formatDeliveryLabel(draft.deliveryType, selectedDeliveryDate),
    [selectedDeliveryDate, draft.deliveryType]
  );

  const deliveryOk = isDeliverySelectionValid(
    draft.deliveryType,
    selectedDeliveryDate,
    deliveryBaseDate ?? new Date(),
    extraLeadTimeDays
  );
  const procurementMissing = getProcurementMissingFields({
    company: draft.companyInformation,
    contact: draft.projectContact,
    shipping: draft.shippingInformation,
    billing: draft.billingInformation,
  });
  const missingLabels = useMemo(() => {
    const labels = procurementMissing.map((field) => field.label);
    if (!deliveryOk) labels.push("delivery date");
    return Array.from(new Set(labels));
  }, [deliveryOk, procurementMissing]);
  const isValid = isDraftReady && draft.items.length > 0 && missingLabels.length === 0;

  const missingMessage = useMemo(() => {
    if (!isDraftReady) return "Loading your project details…";
    if (missingLabels.length === 0) return undefined;
    const visible = missingLabels.slice(0, 3).join(", ");
    const remainder = missingLabels.length - 3;
    return `Complete ${missingLabels.length} required field${missingLabels.length === 1 ? "" : "s"} to continue: ${visible}${remainder > 0 ? ` and ${remainder} more` : ""}.`;
  }, [isDraftReady, missingLabels]);

  const focusFirstMissingField = () => {
    const first = procurementMissing[0];
    const addressKey = first?.key.split(".").slice(-1)[0];
    const addressPrefix = first?.key.startsWith("shipping.address")
      ? "shipping-address"
      : first?.key.startsWith("billing.address")
        ? "billing-address"
        : first?.key.startsWith("company.address")
          ? "company-address"
          : undefined;
    const targetId = first ? FIELD_ID_MAP[first.key] ?? (addressPrefix && addressKey ? `${addressPrefix}-${addressKey}` : undefined) : "delivery-target";
    if (targetId) {
      const element = document.getElementById(targetId);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (element instanceof HTMLElement) window.setTimeout(() => element.focus(), 350);
    }
  };

  const handleNext = () => {
    if (!isValid) {
      setValidationFeedback(missingMessage ?? "Complete the required fields to continue.");
      trackConfiguratorEvent("checkout_validation_error", { cart_id: cartId, missing_count: missingLabels.length, first_missing: missingLabels[0] ?? null });
      focusFirstMissingField();
      return;
    }
    router.push(`/configurator/cart/${encodeURIComponent(cartId)}/confirmation`);
  };

  const handlePoUpload = async (file?: File) => {
    setPoUploadError("");
    if (!file) return;
    if (!PO_TYPES.includes(file.type)) {
      setPoUploadError("Upload a PDF, JPG or PNG purchase order.");
      if (poInputRef.current) poInputRef.current.value = "";
      return;
    }
    if (file.size > PO_MAX_BYTES) {
      setPoUploadError("The purchase order must be 3 MB or smaller.");
      if (poInputRef.current) poInputRef.current.value = "";
      return;
    }

    setPoUploadStatus("saving");
    const fileKey = await persistUploadedFile(file);
    setPoUploadStatus("idle");
    if (!fileKey) {
      setPoUploadError("This browser could not save the purchase order. Try another browser or attach it later.");
      return;
    }

    updateBilling({
      ...draft.billingInformation,
      purchaseOrder: {
        fileKey,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      },
    });
    if (poInputRef.current) poInputRef.current.value = "";
  };

  const companyGstinMismatch =
    Boolean(draft.companyInformation.gstin.trim()) &&
    isGstinValid(draft.companyInformation.gstin) &&
    Boolean(draft.companyInformation.address.state) &&
    !doesGstinMatchState(draft.companyInformation.gstin, draft.companyInformation.address.state);
  const billingAddress = draft.billingInformation.sameAsCompanyAddress
    ? draft.companyInformation.address
    : draft.billingInformation.address;
  const billingGstinMismatch =
    Boolean(draft.billingInformation.gstin.trim()) &&
    isGstinValid(draft.billingInformation.gstin) &&
    Boolean(billingAddress.state) &&
    !doesGstinMatchState(draft.billingInformation.gstin, billingAddress.state);

  return (
    <>
      <ConfiguratorTopBar
        currentStep="company"
        backHref={`/configurator/cart/${encodeURIComponent(cartId)}/review`}
        links={getCartJourneyLinks(
          cartId,
          draft.items[0]?.productId,
          draft.items[0]?.id
        )}
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
        {validationFeedback && <ActionFeedback tone="error" title="More information is required" detail={validationFeedback} onDismiss={() => setValidationFeedback(null)} />}
        {storageSaveError && <ActionFeedback tone="error" title="Checkout autosave is unavailable" detail={storageSaveError} onDismiss={() => setStorageSaveError(null)} />}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[#111111]/50">Cart {cartId}</p>
            <h1 className="text-2xl font-semibold text-[#111111]">Company, Billing & Shipping</h1>
          </div>
          <button
            type="button"
            onClick={() => router.push(`/configurator/cart/${encodeURIComponent(cartId)}/review`)}
            className="inline-flex items-center gap-2 self-start rounded-full border border-[#E5E5E5] px-4 py-2 text-sm font-medium text-[#111111]/75 hover:border-[var(--color-teal)] hover:text-[#111111] sm:self-auto"
          >
            <ArrowLeft size={16} strokeWidth={2.2} />
            Back to Order Summary
          </button>
        </div>

        <section id="company-information" className="scroll-mt-16 rounded-lg border border-[#E5E5E5] bg-white p-5">
          {sectionHeading(
            <Building2 size={18} />,
            "Company information",
            "Used for the proposal, tax review and internal order reference."
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="company-name" className={LABEL_CLASS}>Company name *</label>
              <input
                id="company-name"
                autoComplete="organization"
                className={INPUT_CLASS}
                value={draft.companyInformation.name}
                onChange={(event) => updateCompany({ ...draft.companyInformation, name: event.target.value })}
              />
            </div>
            <div>
              <label htmlFor="company-industry" className={LABEL_CLASS}>Industry *</label>
              <select
                id="company-industry"
                className={INPUT_CLASS}
                value={draft.companyInformation.industry}
                onChange={(event) => updateCompany({
                  ...draft.companyInformation,
                  industry: event.target.value as CompanyInformation["industry"],
                })}
              >
                <option value="">Select industry</option>
                {INDUSTRIES.map((industry) => <option key={industry} value={industry}>{industry}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="company-gstin" className={LABEL_CLASS}>GSTIN (optional)</label>
              <input
                id="company-gstin"
                className={INPUT_CLASS}
                maxLength={15}
                autoCapitalize="characters"
                placeholder="27ABCDE1234F1Z5"
                value={draft.companyInformation.gstin}
                onChange={(event) => updateCompany({ ...draft.companyInformation, gstin: cleanGstin(event.target.value) })}
              />
              {!isGstinValid(draft.companyInformation.gstin) && (
                <p className="mt-1 text-xs text-red-600">Enter a valid 15-character GSTIN.</p>
              )}
              {companyGstinMismatch && (
                <p className="mt-1 text-xs text-red-600">GSTIN state code must match the registered company address.</p>
              )}
            </div>
            <div>
              <label htmlFor="company-website" className={LABEL_CLASS}>Company website (optional)</label>
              <input
                id="company-website"
                className={INPUT_CLASS}
                inputMode="url"
                autoComplete="url"
                placeholder="company.com"
                value={draft.companyInformation.website}
                onChange={(event) => updateCompany({ ...draft.companyInformation, website: event.target.value })}
              />
              {!isWebsiteValid(draft.companyInformation.website) && (
                <p className="mt-1 text-xs text-red-600">Enter a valid website, such as company.com.</p>
              )}
            </div>
            <div>
              <label htmlFor="company-po" className={LABEL_CLASS}>PO number (optional)</label>
              <input
                id="company-po"
                className={INPUT_CLASS}
                placeholder="Add now or after approval"
                value={draft.companyInformation.poNumber}
                onChange={(event) => updateCompany({ ...draft.companyInformation, poNumber: event.target.value })}
              />
            </div>
            <div>
              <label htmlFor="company-cost-centre" className={LABEL_CLASS}>Cost centre or department (optional)</label>
              <input
                id="company-cost-centre"
                className={INPUT_CLASS}
                placeholder="People Ops, Marketing, CC-104…"
                value={draft.companyInformation.costCentre}
                onChange={(event) => updateCompany({ ...draft.companyInformation, costCentre: event.target.value })}
              />
            </div>
          </div>
        </section>

        <section id="project-contact" className="scroll-mt-16 rounded-lg border border-[#E5E5E5] bg-white p-5">
          {sectionHeading(
            <UserRound size={18} />,
            "Primary project contact",
            "The person coordinating approvals, artwork and production communication."
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="contact-first-name" className={LABEL_CLASS}>First name *</label>
              <input
                id="contact-first-name"
                autoComplete="given-name"
                className={INPUT_CLASS}
                value={draft.projectContact.firstName}
                onChange={(event) => updateContact({ ...draft.projectContact, firstName: event.target.value })}
              />
            </div>
            <div>
              <label htmlFor="contact-last-name" className={LABEL_CLASS}>Last name *</label>
              <input
                id="contact-last-name"
                autoComplete="family-name"
                className={INPUT_CLASS}
                value={draft.projectContact.lastName}
                onChange={(event) => updateContact({ ...draft.projectContact, lastName: event.target.value })}
              />
            </div>
            <div>
              <label htmlFor="contact-email" className={LABEL_CLASS}>Work email *</label>
              <input
                id="contact-email"
                type="email"
                autoComplete="email"
                className={INPUT_CLASS}
                value={draft.projectContact.email}
                onChange={(event) => updateContact({ ...draft.projectContact, email: event.target.value })}
              />
              {draft.projectContact.email && !isEmailValid(draft.projectContact.email) && (
                <p className="mt-1 text-xs text-red-600">Enter a valid work email.</p>
              )}
            </div>
            <div>
              <label htmlFor="contact-phone" className={LABEL_CLASS}>Phone *</label>
              <input
                id="contact-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                className={INPUT_CLASS}
                placeholder="98765 43210"
                value={draft.projectContact.phone}
                onChange={(event) => updateContact({ ...draft.projectContact, phone: formatIndianPhone(event.target.value) })}
              />
              {draft.projectContact.phone && !isIndianPhoneValid(draft.projectContact.phone) && (
                <p className="mt-1 text-xs text-red-600">Enter a valid 10-digit Indian mobile number.</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="contact-department" className={LABEL_CLASS}>Department *</label>
              <select
                id="contact-department"
                className={INPUT_CLASS}
                value={draft.projectContact.department}
                onChange={(event) => updateContact({
                  ...draft.projectContact,
                  department: event.target.value as ProjectContact["department"],
                })}
              >
                <option value="">Select department</option>
                {PROJECT_DEPARTMENTS.map((department) => (
                  <option key={department} value={department}>{department}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section id="shipping-information" className="scroll-mt-16 rounded-lg border border-[#E5E5E5] bg-white p-5">
          {sectionHeading(
            <MapPin size={18} />,
            "Shipping information",
            "Where the primary shipment should be delivered."
          )}
          <div className="mb-4">
            <label htmlFor="shipping-recipient" className={LABEL_CLASS}>Recipient name *</label>
            <input
              id="shipping-recipient"
              autoComplete="name"
              className={INPUT_CLASS}
              value={draft.shippingInformation.recipientName}
              onChange={(event) => updateShipping({ ...draft.shippingInformation, recipientName: event.target.value })}
            />
          </div>
          <AddressForm
            idPrefix="shipping-address"
            value={draft.shippingInformation.address}
            onChange={(address) => updateShipping({ ...draft.shippingInformation, address })}
          />
          <div className="mt-5 border-t border-[#E5E5E5] pt-4">
            <label className="flex cursor-pointer items-start gap-3 text-sm text-[#111111]">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-[var(--color-teal)]"
                checked={draft.shippingInformation.multipleLocations}
                onChange={(event) => updateShipping({
                  ...draft.shippingInformation,
                  multipleLocations: event.target.checked,
                })}
              />
              <span>
                <span className="font-medium">This order needs multiple delivery locations</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-[#111111]/55">
                  The address above remains the primary location. Our team will confirm split quantities and final shipping charges after review.
                </span>
              </span>
            </label>
            {draft.shippingInformation.multipleLocations && (
              <div className="mt-4">
                <label htmlFor="multiple-location-notes" className={LABEL_CLASS}>Locations or distribution notes (optional)</label>
                <textarea
                  id="multiple-location-notes"
                  rows={3}
                  className={INPUT_CLASS}
                  placeholder="Example: Bengaluru 80 units, Mumbai 50 units. A detailed sheet can be shared later."
                  value={draft.shippingInformation.multipleLocationsNotes}
                  onChange={(event) => updateShipping({
                    ...draft.shippingInformation,
                    multipleLocationsNotes: event.target.value,
                  })}
                />
              </div>
            )}
          </div>
        </section>

        <section id="delivery-target" className="scroll-mt-16 rounded-lg border border-[#E5E5E5] bg-white p-5">
          <DeliveryDatePicker
            orderConfirmedDate={deliveryBaseDate}
            extraLeadTimeDays={extraLeadTimeDays}
            onDateSelect={(date, type) => {
              updateDraft({
                selectedDeliveryDateIso: date.toISOString(),
                deliveryType: type,
                orderConfirmedDateIso: draft.orderConfirmedDateIso ?? new Date().toISOString(),
              });
            }}
            selectedDate={selectedDeliveryDate}
            selectedType={draft.deliveryType}
          />
          <p className="mt-3 text-xs leading-relaxed text-[#111111]/55">
            This is a target date. The final production schedule is confirmed after artwork review, approval and agreed payment terms.
          </p>
        </section>

        <section id="billing-information" className="scroll-mt-16 rounded-lg border border-[#E5E5E5] bg-white p-5">
          {sectionHeading(
            <ReceiptText size={18} />,
            "Billing information",
            "Details Finance or Procurement needs for the final GST invoice."
          )}
          <label className="mb-5 flex cursor-pointer items-start gap-3 rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] p-3 text-sm text-[#111111]">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[var(--color-teal)]"
              checked={draft.billingInformation.sameAsCompanyAddress}
              onChange={(event) => updateBilling({
                ...draft.billingInformation,
                sameAsCompanyAddress: event.target.checked,
              })}
            />
            <span>
              <span className="font-medium">Billing address is the same as the registered company address</span>
              <span className="mt-0.5 block text-xs text-[#111111]/50">Uncheck only when invoices should use another legal address.</span>
            </span>
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="billing-entity" className={LABEL_CLASS}>Billing entity *</label>
              <input
                id="billing-entity"
                autoComplete="organization"
                className={INPUT_CLASS}
                value={draft.billingInformation.entity}
                onChange={(event) => updateBilling({ ...draft.billingInformation, entity: event.target.value })}
              />
            </div>
            <div>
              <label htmlFor="billing-email" className={LABEL_CLASS}>Accounts-payable email *</label>
              <input
                id="billing-email"
                type="email"
                autoComplete="section-billing email"
                className={INPUT_CLASS}
                placeholder="accounts@company.com"
                value={draft.billingInformation.accountsPayableEmail}
                onChange={(event) => updateBilling({ ...draft.billingInformation, accountsPayableEmail: event.target.value })}
              />
              {draft.billingInformation.accountsPayableEmail && !isEmailValid(draft.billingInformation.accountsPayableEmail) && (
                <p className="mt-1 text-xs text-red-600">Enter a valid accounts-payable email.</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="billing-gstin" className={LABEL_CLASS}>Billing GSTIN (optional)</label>
              <input
                id="billing-gstin"
                className={INPUT_CLASS}
                maxLength={15}
                autoCapitalize="characters"
                placeholder="27ABCDE1234F1Z5"
                value={draft.billingInformation.gstin}
                onChange={(event) => updateBilling({ ...draft.billingInformation, gstin: cleanGstin(event.target.value) })}
              />
              {!isGstinValid(draft.billingInformation.gstin) && (
                <p className="mt-1 text-xs text-red-600">Enter a valid 15-character GSTIN.</p>
              )}
              {billingGstinMismatch && (
                <p className="mt-1 text-xs text-red-600">GSTIN state code must match the billing address state.</p>
              )}
            </div>
          </div>

          <div className="mt-6 border-t border-[#E5E5E5] pt-5">
            <h3 className="text-sm font-medium text-[#111111]">
              {draft.billingInformation.sameAsCompanyAddress
                ? "Registered company / billing address *"
                : "Billing address *"}
            </h3>
            <p className="mb-4 mt-1 text-xs text-[#111111]/50">
              {draft.billingInformation.sameAsCompanyAddress
                ? "This address will be used as the company address and on the GST invoice."
                : "Use the legal address that should appear on the GST invoice."}
            </p>
            <AddressForm
              idPrefix={draft.billingInformation.sameAsCompanyAddress ? "company-address" : "billing-address"}
              value={draft.billingInformation.sameAsCompanyAddress
                ? draft.companyInformation.address
                : draft.billingInformation.address}
              onChange={(address) => {
                if (draft.billingInformation.sameAsCompanyAddress) {
                  updateCompany({ ...draft.companyInformation, address });
                } else {
                  updateBilling({ ...draft.billingInformation, address });
                }
              }}
            />
          </div>

          <div className="mt-6 border-t border-[#E5E5E5] pt-5">
            <label className={LABEL_CLASS}>Purchase order upload (optional)</label>
            <input
              ref={poInputRef}
              type="file"
              className="sr-only"
              accept="application/pdf,image/jpeg,image/png"
              onChange={(event) => void handlePoUpload(event.target.files?.[0])}
            />
            {draft.billingInformation.purchaseOrder ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText size={18} className="shrink-0 text-[var(--color-teal-dark)]" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#111111]">{draft.billingInformation.purchaseOrder.fileName}</p>
                    <p className="text-xs text-[#111111]/50">{formatFileSize(draft.billingInformation.purchaseOrder.fileSize)} · attached to the reservation notification</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" onClick={() => poInputRef.current?.click()} className="rounded-full border border-[#E5E5E5] px-2.5 py-1 text-[11px] font-semibold text-[#111111]/65 hover:bg-white">Replace</button>
                <button
                  type="button"
                  aria-label="Remove purchase order"
                  className="rounded-full p-2 text-[#111111]/50 hover:bg-white hover:text-[#111111]"
                  onClick={() => updateBilling({ ...draft.billingInformation, purchaseOrder: undefined })}
                >
                  <X size={16} />
                </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={poUploadStatus === "saving"}
                onClick={() => poInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#CFCFCF] bg-[#F7F7F7] px-4 py-4 text-sm font-medium text-[#111111]/70 hover:border-[var(--color-teal)] hover:text-[#111111] disabled:cursor-wait disabled:opacity-60"
              >
                <Upload size={17} />
                {poUploadStatus === "saving" ? "Saving purchase order…" : "Upload PO (PDF, JPG or PNG, up to 3 MB)"}
              </button>
            )}
            {poUploadError && <p className="mt-2 text-xs text-red-600">{poUploadError}</p>}
          </div>
        </section>

        <section id="order-notes" className="scroll-mt-16 rounded-lg border border-[#E5E5E5] bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#111111]">Order notes & communication</h2>
          <p className="mt-1 text-xs text-[#111111]/55">These preferences apply once to the complete order and are no longer duplicated inside address forms.</p>
          <div className="mt-4">
            <label htmlFor="project-notes" className={LABEL_CLASS}>Order notes (optional)</label>
            <textarea
              id="project-notes"
              rows={3}
              maxLength={1000}
              className={INPUT_CLASS}
              placeholder="Event date, packing instructions, approval requirements or anything our team should know"
              value={draft.projectPreferences.orderNotes}
              onChange={(event) => updatePreferences({ ...draft.projectPreferences, orderNotes: event.target.value })}
            />
            <p className="mt-1 text-right text-[11px] text-[#111111]/45">{draft.projectPreferences.orderNotes.length}/1000</p>
          </div>
          <label className="mt-4 flex items-center gap-2 text-xs text-[#111111]/75">
            <input
              type="checkbox"
              checked={draft.projectPreferences.receiveEmails}
              onChange={(event) => updatePreferences({ ...draft.projectPreferences, receiveEmails: event.target.checked })}
            />
            Receive occasional Garmops product and service updates
          </label>
        </section>

        <section className="space-y-2 rounded-lg border border-[#E5E5E5] bg-white p-5">
          <p className="text-sm font-medium text-[#111111]">Have a promo code?</p>
          <p className="text-sm text-[#111111]/60">Contact your account manager before reserving the production review.</p>
        </section>
        </div>

        <div className="lg:sticky lg:top-36 lg:self-start">
          <CartSummarySidebar
            subtotal={totals.subtotal}
            volumeDiscount={totals.volumeDiscount}
            shippingFee={totals.shippingFee}
            gst={totals.gst}
            delivery={deliveryLabel}
            total={totals.total}
            onNext={handleNext}
            nextLabel="Next: Review & Payment"
            nextDisabled={!isValid}
            disabledMessage={missingMessage}
            onDisabledNext={handleNext}
            sticky={false}
          />
        </div>
      </div>
    </>
  );
}
