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
import { ArrowLeft, MapPin, UserRound } from "lucide-react";
import { DeliveryDatePicker } from "@/components/configurator/cart/DeliveryDatePicker";
import {
  AddressForm,
  digitsOnly,
  isEmailValid,
  isIndianPhoneValid,
} from "@/components/configurator/cart/AddressForm";
import { CartSummarySidebar } from "@/components/configurator/cart/CartSummarySidebar";
import {
  ConfiguratorTopBar,
  getCartJourneyLinks,
} from "@/components/configurator/ConfiguratorTopBar";
import {
  getProcurementMissingFields,
  type CompanyInformation,
  type ProjectContact,
  type ShippingInformation,
} from "./checkoutDetails";
import {
  calculateTotals,
  createDraft,
  readDraft,
  type CartDraft,
  writeDraft,
} from "./cartDraft";
import {
  formatDeliveryLabel,
  isDeliverySelectionValid,
} from "@/lib/configurator/delivery";
import { CUSTOM_DYE_EXTRA_LEAD_TIME_DAYS } from "@/lib/configurator/colours";
import { trackConfiguratorEvent } from "@/lib/configurator/analytics";
import { ActionFeedback } from "@/components/configurator/ActionFeedback";

export interface BillingShippingStepProps {
  cartId: string;
}

const INPUT_CLASS =
  "liquid-glass-control w-full rounded-xl border px-3 py-2 text-sm text-[#111111] placeholder:text-[#111111]/40 focus:!border-[var(--color-teal)] focus:outline-none";
const LABEL_CLASS = "mb-1 block text-xs font-medium text-[#111111]/70";

function formatIndianPhone(value: string): string {
  let digits = digitsOnly(value);
  if (digits.startsWith("91") && digits.length > 10) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length > 10) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  return digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
}

const FIELD_ID_MAP: Record<string, string> = {
  "company.name": "company-name",
  "contact.firstName": "contact-first-name",
  "contact.lastName": "contact-last-name",
  "contact.email": "contact-email",
  "contact.phone": "contact-phone",
  "shipping.recipientName": "contact-first-name",
};

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
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#111111]">
          {title}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-[#111111]/55">
          {description}
        </p>
      </div>
    </div>
  );
}

function withInferredCheckoutDetails(draft: CartDraft): CartDraft {
  const contactName =
    `${draft.projectContact.firstName} ${draft.projectContact.lastName}`.trim();
  const shippingInformation = {
    ...draft.shippingInformation,
    recipientName: contactName,
  };
  const companyInformation = {
    ...draft.companyInformation,
    address: shippingInformation.address,
  };
  const billingInformation = {
    ...draft.billingInformation,
    sameAsCompanyAddress: true,
    entity: companyInformation.name,
    accountsPayableEmail: draft.projectContact.email,
    gstin: companyInformation.gstin,
  };

  return {
    ...draft,
    companyInformation,
    shippingInformation,
    billingInformation,
  };
}

export function BillingShippingStep({ cartId }: BillingShippingStepProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<CartDraft>(() => createDraft(cartId));
  const [isDraftReady, setIsDraftReady] = useState(false);
  const [validationFeedback, setValidationFeedback] = useState<string | null>(
    null
  );
  const [storageSaveError, setStorageSaveError] = useState<string | null>(null);
  const formStartedRef = useRef(false);

  useEffect(() => {
    const loadDraft = window.setTimeout(() => {
      const savedDraft = readDraft(cartId);
      if (savedDraft.items.length === 0) {
        router.replace(
          `/configurator/cart/${encodeURIComponent(cartId)}/review`
        );
        return;
      }

      const preparedDraft = withInferredCheckoutDetails(savedDraft);
      setDraft(preparedDraft);
      writeDraft(cartId, preparedDraft);
      setIsDraftReady(true);
    }, 0);

    return () => window.clearTimeout(loadDraft);
  }, [cartId, router]);

  const selectedDeliveryDate = useMemo(
    () =>
      draft.selectedDeliveryDateIso
        ? new Date(draft.selectedDeliveryDateIso)
        : undefined,
    [draft.selectedDeliveryDateIso]
  );
  const totals = calculateTotals(draft.items, draft.deliveryType);
  const extraLeadTimeDays = draft.items.some(
    (item) => item.colour.type === "custom_dye"
  )
    ? CUSTOM_DYE_EXTRA_LEAD_TIME_DAYS.max
    : 0;
  const deliveryBaseDate = useMemo(
    () =>
      draft.orderConfirmedDateIso
        ? new Date(draft.orderConfirmedDateIso)
        : undefined,
    [draft.orderConfirmedDateIso]
  );

  const markFormStarted = useCallback(() => {
    if (formStartedRef.current) return;
    formStartedRef.current = true;
    trackConfiguratorEvent("company_form_started", { cart_id: cartId });
  }, [cartId]);

  const persistCartDraft = useCallback(
    (next: CartDraft) => {
      const saved = writeDraft(cartId, next);
      window.queueMicrotask(() => {
        setStorageSaveError(
          saved
            ? null
            : "This browser could not save the latest checkout changes. Keep this tab open and try again before continuing."
        );
      });
    },
    [cartId]
  );

  const updateDraft = useCallback(
    (patch: Partial<CartDraft>) => {
      markFormStarted();
      setDraft((previous) => {
        const next = withInferredCheckoutDetails({ ...previous, ...patch });
        persistCartDraft(next);
        return next;
      });
    },
    [markFormStarted, persistCartDraft]
  );

  const updateCompany = useCallback(
    (companyInformation: CompanyInformation) => {
      updateDraft({ companyInformation });
    },
    [updateDraft]
  );

  const updateContact = useCallback(
    (projectContact: ProjectContact) => {
      updateDraft({ projectContact });
    },
    [updateDraft]
  );

  const updateShipping = useCallback(
    (shippingInformation: ShippingInformation) => {
      updateDraft({ shippingInformation });
    },
    [updateDraft]
  );

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
  const isValid =
    isDraftReady && draft.items.length > 0 && missingLabels.length === 0;

  const missingMessage = useMemo(() => {
    if (!isDraftReady) return "Loading your delivery details…";
    if (missingLabels.length === 0) return undefined;
    const visible = missingLabels.slice(0, 3).join(", ");
    const remainder = missingLabels.length - 3;
    return `Complete ${missingLabels.length} required field${
      missingLabels.length === 1 ? "" : "s"
    } to continue: ${visible}${
      remainder > 0 ? ` and ${remainder} more` : ""
    }.`;
  }, [isDraftReady, missingLabels]);

  const focusFirstMissingField = () => {
    const first = procurementMissing[0];
    const addressKey = first?.key.split(".").at(-1);
    const targetId = first?.key.startsWith("shipping.address")
      ? `shipping-address-${addressKey}`
      : first
        ? FIELD_ID_MAP[first.key]
        : "delivery-target";

    if (!targetId) return;
    const element = document.getElementById(targetId);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (element instanceof HTMLElement) {
      window.setTimeout(() => element.focus(), 350);
    }
  };

  const handleNext = () => {
    if (!isValid) {
      setValidationFeedback(
        missingMessage ?? "Complete the required fields to continue."
      );
      trackConfiguratorEvent("checkout_validation_error", {
        cart_id: cartId,
        missing_count: missingLabels.length,
        first_missing: missingLabels[0] ?? null,
      });
      focusFirstMissingField();
      return;
    }

    router.push(
      `/configurator/cart/${encodeURIComponent(cartId)}/confirmation`
    );
  };

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
          {validationFeedback && (
            <ActionFeedback
              tone="error"
              title="More information is required"
              detail={validationFeedback}
              onDismiss={() => setValidationFeedback(null)}
            />
          )}
          {storageSaveError && (
            <ActionFeedback
              tone="error"
              title="Checkout autosave is unavailable"
              detail={storageSaveError}
              onDismiss={() => setStorageSaveError(null)}
            />
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[#111111]/50">
                Cart {cartId}
              </p>
              <h1 className="text-2xl font-semibold text-[#111111]">
                Delivery details
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#111111]/55">
                Just the essentials for your reservation. Invoice and
                procurement details can be shared after our team reviews the
                order.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/configurator/cart/${encodeURIComponent(cartId)}/review`
                )
              }
              className="inline-flex shrink-0 items-center gap-2 self-start whitespace-nowrap rounded-full border border-[#E5E5E5] px-4 py-2 text-sm font-medium text-[#111111]/75 hover:border-[var(--color-teal)] hover:text-[#111111] sm:self-auto"
            >
              <ArrowLeft size={16} strokeWidth={2.2} />
              Back to Order Summary
            </button>
          </div>

          <section
            id="delivery-target"
            className="liquid-glass-panel scroll-mt-16 rounded-[24px] border p-5"
          >
            <DeliveryDatePicker
              orderConfirmedDate={deliveryBaseDate}
              extraLeadTimeDays={extraLeadTimeDays}
              onDateSelect={(date, type) => {
                updateDraft({
                  selectedDeliveryDateIso: date.toISOString(),
                  deliveryType: type,
                  orderConfirmedDateIso:
                    draft.orderConfirmedDateIso ?? new Date().toISOString(),
                });
              }}
              selectedDate={selectedDeliveryDate}
              selectedType={draft.deliveryType}
            />
            <p className="mt-3 text-xs leading-relaxed text-[#111111]/55">
              This is a target date. The final production schedule is confirmed
              after artwork review and approval.
            </p>
          </section>

          <section
            id="contact-details"
            className="liquid-glass-panel scroll-mt-16 rounded-[24px] border p-5"
          >
            {sectionHeading(
              <UserRound size={18} />,
              "Contact details",
              "Who should receive order updates and coordinate the delivery?"
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="company-name" className={LABEL_CLASS}>
                  Company name *
                </label>
                <input
                  id="company-name"
                  autoComplete="organization"
                  className={INPUT_CLASS}
                  value={draft.companyInformation.name}
                  onChange={(event) =>
                    updateCompany({
                      ...draft.companyInformation,
                      name: event.target.value,
                    })
                  }
                />
              </div>
              <div>
                <label htmlFor="contact-first-name" className={LABEL_CLASS}>
                  First name *
                </label>
                <input
                  id="contact-first-name"
                  autoComplete="given-name"
                  className={INPUT_CLASS}
                  value={draft.projectContact.firstName}
                  onChange={(event) =>
                    updateContact({
                      ...draft.projectContact,
                      firstName: event.target.value,
                    })
                  }
                />
              </div>
              <div>
                <label htmlFor="contact-last-name" className={LABEL_CLASS}>
                  Last name *
                </label>
                <input
                  id="contact-last-name"
                  autoComplete="family-name"
                  className={INPUT_CLASS}
                  value={draft.projectContact.lastName}
                  onChange={(event) =>
                    updateContact({
                      ...draft.projectContact,
                      lastName: event.target.value,
                    })
                  }
                />
              </div>
              <div>
                <label htmlFor="contact-email" className={LABEL_CLASS}>
                  Email *
                </label>
                <input
                  id="contact-email"
                  type="email"
                  autoComplete="email"
                  className={INPUT_CLASS}
                  value={draft.projectContact.email}
                  onChange={(event) =>
                    updateContact({
                      ...draft.projectContact,
                      email: event.target.value,
                    })
                  }
                />
                {draft.projectContact.email &&
                  !isEmailValid(draft.projectContact.email) && (
                    <p className="mt-1 text-xs text-red-600">
                      Enter a valid email.
                    </p>
                  )}
              </div>
              <div>
                <label htmlFor="contact-phone" className={LABEL_CLASS}>
                  Phone *
                </label>
                <input
                  id="contact-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  className={INPUT_CLASS}
                  placeholder="98765 43210"
                  value={draft.projectContact.phone}
                  onChange={(event) =>
                    updateContact({
                      ...draft.projectContact,
                      phone: formatIndianPhone(event.target.value),
                    })
                  }
                />
                {draft.projectContact.phone &&
                  !isIndianPhoneValid(draft.projectContact.phone) && (
                    <p className="mt-1 text-xs text-red-600">
                      Enter a valid 10-digit Indian mobile number.
                    </p>
                  )}
              </div>
            </div>
          </section>

          <section
            id="shipping-information"
            className="liquid-glass-panel scroll-mt-16 rounded-[24px] border p-5"
          >
            {sectionHeading(
              <MapPin size={18} />,
              "Delivery address",
              "Enter one primary delivery location in India. We’ll use the contact name above as the recipient."
            )}
            <AddressForm
              compact
              showCountry={false}
              idPrefix="shipping-address"
              value={draft.shippingInformation.address}
              onChange={(address) =>
                updateShipping({ ...draft.shippingInformation, address })
              }
            />
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
