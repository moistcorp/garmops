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
import { MapPin, ReceiptText, UserRound } from "lucide-react";
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
  getCartProductLabel,
  getCartJourneyLinks,
} from "@/components/configurator/ConfiguratorTopBar";
import {
  getProcurementMissingFields,
  isGstinValid,
  type BillingInformation,
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
import { CUSTOM_DYE_EXTRA_LEAD_TIME_DAYS } from "@/lib/configurator/colourRules";
import { trackConfiguratorEvent } from "@/lib/configurator/analytics";
import { ActionFeedback } from "@/components/configurator/ActionFeedback";
import { formatSpecCode } from "@/lib/orders/format";

export interface BillingShippingStepProps {
  cartId: string;
  accountDefaults?: CheckoutAccountDefaults;
}

export type CheckoutAccountDefaults = Readonly<{
  gstin: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  billingEmail: string;
  billingAddress: Readonly<{
    country: string;
    addressLine1: string;
    addressLine2?: string;
    zip: string;
    city: string;
    state?: string;
  }>;
  shippingAddress: Readonly<{
    country: string;
    addressLine1: string;
    addressLine2?: string;
    zip: string;
    city: string;
    state?: string;
  }>;
}>;

const INPUT_CLASS =
  "techpack-control w-full rounded-[4px] border px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-primary)]/40 focus:!border-[var(--color-accent)] focus:outline-none";
const LABEL_CLASS = "mb-1 block text-xs font-medium text-[var(--text-primary)]/70";

function formatIndianPhone(value: string): string {
  let digits = digitsOnly(value);
  if (digits.startsWith("91") && digits.length > 10) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length > 10) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  return digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
}

const FIELD_ID_MAP: Record<string, string> = {
  "contact.firstName": "contact-first-name",
  "contact.lastName": "contact-last-name",
  "contact.email": "contact-email",
  "contact.phone": "contact-phone",
  "shipping.recipientName": "contact-first-name",
  "billing.gstin": "billing-gstin",
};

function sectionHeading(
  index: string,
  icon: ReactNode,
  title: string,
  description: string
) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <span className="rounded-[4px] bg-[var(--color-accent)]/10 p-2 text-[var(--color-accent-dark)]">
        {icon}
      </span>
      <div>
        <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">
          {index} / Delivery specification
        </p>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-primary)]">
          {title}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-[var(--text-primary)]/55">
          {description}
        </p>
      </div>
    </div>
  );
}

function withInferredCheckoutDetails(
  draft: CartDraft,
  accountDefaults?: CheckoutAccountDefaults,
): CartDraft {
  const contactName =
    `${draft.projectContact.firstName} ${draft.projectContact.lastName}`.trim();
  const shippingInformation = {
    ...draft.shippingInformation,
    recipientName: contactName,
  };
  const billingInformation = {
    ...draft.billingInformation,
    entity: draft.billingInformation.entity || contactName,
    accountsPayableEmail:
      draft.billingInformation.accountsPayableEmail ||
      accountDefaults?.billingEmail ||
      draft.projectContact.email,
  };

  return { ...draft, shippingInformation, billingInformation };
}

function withAccountDefaults(
  draft: CartDraft,
  defaults?: CheckoutAccountDefaults,
): CartDraft {
  if (!defaults) return draft;
  const value = (current: string, fallback: string) =>
    current.trim() ? current : fallback;
  const shippingAddress = draft.shippingInformation.address;
  const billingAddress = draft.billingInformation.address;

  return {
    ...draft,
    projectContact: {
      ...draft.projectContact,
      firstName: value(draft.projectContact.firstName, defaults.firstName),
      lastName: value(draft.projectContact.lastName, defaults.lastName),
      email: value(draft.projectContact.email, defaults.email),
      phone: value(draft.projectContact.phone, defaults.phone),
    },
    shippingInformation: {
      ...draft.shippingInformation,
      address: {
        country: value(shippingAddress.country, defaults.shippingAddress.country),
        addressLine1: value(
          shippingAddress.addressLine1,
          defaults.shippingAddress.addressLine1,
        ),
        addressLine2: value(
          shippingAddress.addressLine2 ?? "",
          defaults.shippingAddress.addressLine2 ?? "",
        ),
        zip: value(shippingAddress.zip, defaults.shippingAddress.zip),
        city: value(shippingAddress.city, defaults.shippingAddress.city),
        state: value(
          shippingAddress.state ?? "",
          defaults.shippingAddress.state ?? "",
        ),
      },
    },
    billingInformation: {
      ...draft.billingInformation,
      accountsPayableEmail: value(
        draft.billingInformation.accountsPayableEmail,
        defaults.billingEmail || defaults.email,
      ),
      gstin: value(draft.billingInformation.gstin, defaults.gstin),
      address: {
        country: value(billingAddress.country, defaults.billingAddress.country),
        addressLine1: value(
          billingAddress.addressLine1,
          defaults.billingAddress.addressLine1,
        ),
        addressLine2: value(
          billingAddress.addressLine2 ?? "",
          defaults.billingAddress.addressLine2 ?? "",
        ),
        zip: value(billingAddress.zip, defaults.billingAddress.zip),
        city: value(billingAddress.city, defaults.billingAddress.city),
        state: value(
          billingAddress.state ?? "",
          defaults.billingAddress.state ?? "",
        ),
      },
    },
  };
}

export function BillingShippingStep({
  cartId,
  accountDefaults,
}: BillingShippingStepProps) {
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

      const preparedDraft = withInferredCheckoutDetails(
        withAccountDefaults(savedDraft, accountDefaults),
        accountDefaults,
      );
      setDraft(preparedDraft);
      writeDraft(cartId, preparedDraft);
      setIsDraftReady(true);
    }, 0);

    return () => window.clearTimeout(loadDraft);
  }, [accountDefaults, cartId, router]);

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
      setValidationFeedback(null);
      setDraft((previous) => {
        const next = withInferredCheckoutDetails(
          { ...previous, ...patch },
          accountDefaults,
        );
        persistCartDraft(next);
        return next;
      });
    },
    [accountDefaults, markFormStarted, persistCartDraft]
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

  const updateBilling = useCallback(
    (billingInformation: BillingInformation) => {
      updateDraft({ billingInformation });
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
    contact: draft.projectContact,
    shipping: draft.shippingInformation,
    billing: draft.billingInformation,
  });
  const missingLabels = useMemo(() => {
    const labels = procurementMissing
      .filter((field) => field.key !== "shipping.recipientName")
      .map((field) => field.label);
    if (!deliveryOk) labels.push("delivery date");
    return Array.from(new Set(labels));
  }, [deliveryOk, procurementMissing]);
  const isValid =
    isDraftReady &&
    draft.items.length > 0 &&
    procurementMissing.length === 0 &&
    deliveryOk;

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
      : first?.key.startsWith("billing.address")
        ? `billing-address-${addressKey}`
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
        currentStep="delivery"
        backHref={`/configurator/cart/${encodeURIComponent(cartId)}/review`}
        showCart
        productName={getCartProductLabel(draft.items)}
        specReference={`CART-${cartId}`}
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

          <div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-primary)]/50">
              {formatSpecCode(`CART-${cartId}`)}
            </p>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
              Delivery details
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--text-primary)]/55">
              Confirm your contact, delivery and billing details. Saved account
              information is filled automatically. Checkout details are stored as an immutable order snapshot after payment.
            </p>
          </div>

          <section
            id="delivery-target"
            className="techpack-panel scroll-mt-16 rounded-[4px] border p-5"
          >
            <p className="mb-3 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">
              01 / Delivery window
            </p>
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
            <p className="mt-3 text-xs leading-relaxed text-[var(--text-primary)]/55">
              This is a target date. The final production schedule is confirmed
              after artwork review and approval.
            </p>
          </section>

          <section
            id="contact-details"
            className="techpack-panel scroll-mt-16 rounded-[4px] border p-5"
          >
            {sectionHeading(
              "02",
              <UserRound size={18} />,
              "Contact details",
              "Who should receive order updates and coordinate the delivery?"
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            className="techpack-panel scroll-mt-16 rounded-[4px] border p-5"
          >
            {sectionHeading(
              "03",
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

          <section
            id="billing-information"
            className="techpack-panel scroll-mt-16 rounded-[4px] border p-5"
          >
            {sectionHeading(
              "04",
              <ReceiptText size={18} />,
              "Billing & GST",
              "GSTIN is optional. Add it when you need a GST invoice for this order."
            )}
            <div className="space-y-5">
              <div>
                <label htmlFor="billing-gstin" className={LABEL_CLASS}>
                  GSTIN <span className="font-normal text-[var(--text-primary)]/45">(optional)</span>
                </label>
                <input
                  id="billing-gstin"
                  autoComplete="off"
                  className={`${INPUT_CLASS} uppercase`}
                  maxLength={15}
                  placeholder="22AAAAA0000A1Z5"
                  value={draft.billingInformation.gstin}
                  onChange={(event) => {
                    const gstin = event.target.value
                      .toUpperCase()
                      .replace(/[^0-9A-Z]/g, "")
                      .slice(0, 15);
                    updateBilling({ ...draft.billingInformation, gstin });
                  }}
                />
                {draft.billingInformation.gstin &&
                  !isGstinValid(draft.billingInformation.gstin) && (
                    <p className="mt-1 text-xs text-red-600">
                      Enter a valid 15-character GSTIN.
                    </p>
                  )}
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-[4px] border border-[var(--color-rule)] p-3 text-sm text-[var(--text-primary)]/75">
                <input
                  type="checkbox"
                  checked={draft.billingInformation.sameAsCompanyAddress}
                  onChange={(event) =>
                    updateBilling({
                      ...draft.billingInformation,
                      sameAsCompanyAddress: event.target.checked,
                    })
                  }
                  className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
                />
                <span>
                  <strong className="block font-medium text-[var(--text-primary)]">
                    Billing address same as delivery address
                  </strong>
                  <span className="mt-0.5 block text-xs leading-relaxed text-[var(--text-primary)]/50">
                    Uncheck this to enter a different billing address.
                  </span>
                </span>
              </label>

              {!draft.billingInformation.sameAsCompanyAddress && (
                <AddressForm
                  compact
                  showCountry={false}
                  idPrefix="billing-address"
                  value={draft.billingInformation.address}
                  onChange={(address) =>
                    updateBilling({ ...draft.billingInformation, address })
                  }
                />
              )}
            </div>
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
            nextLabel="Confirm spec · review & payment"
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
