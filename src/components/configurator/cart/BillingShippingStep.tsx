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
import { CheckCircle2, MapPin, ReceiptText, ShieldCheck, UserRound } from "lucide-react";
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
  getIndiaCalendarDate,
  isDeliverySelectionValid,
} from "@/lib/configurator/delivery";
import { CUSTOM_DYE_EXTRA_LEAD_TIME_DAYS } from "@/lib/configurator/colourRules";
import { trackConfiguratorEvent } from "@/lib/configurator/analytics";
import { ActionFeedback } from "@/components/configurator/ActionFeedback";
import CustomerAuthFlow from "@/components/auth/CustomerAuthFlow";
import { formatSpecCode } from "@/lib/orders/format";

export interface BillingShippingStepProps {
  cartId: string;
  accountContext?: CheckoutAccountContext;
}

export type CheckoutAccountDefaults = Readonly<{
  gstin: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  billingEmail: string;
  billingEntity: string;
  billingSameAsShipping: boolean;
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

export type CheckoutAccountContext = Readonly<{
  authenticatedEmail: string;
  hasSavedDetails: boolean;
  defaults: CheckoutAccountDefaults;
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
  const contactName = `${draft.projectContact.firstName} ${draft.projectContact.lastName}`.trim();
  return {
    ...draft,
    shippingInformation: {
      ...draft.shippingInformation,
      recipientName: contactName,
    },
    billingInformation: {
      ...draft.billingInformation,
      entity: draft.billingInformation.entity || accountDefaults?.billingEntity || contactName,
      accountsPayableEmail:
        draft.billingInformation.accountsPayableEmail ||
        accountDefaults?.billingEmail ||
        draft.projectContact.email,
    },
  };
}

type DefaultsMode = "fill-empty" | "replace";

function withAccountDefaults(
  draft: CartDraft,
  defaults: CheckoutAccountDefaults,
  mode: DefaultsMode,
): CartDraft {
  const value = (current: string | undefined, fallback: string) =>
    mode === "replace" ? fallback : current?.trim() ? current : fallback;
  const shippingAddress = draft.shippingInformation.address;
  const billingAddress = draft.billingInformation.address;

  return withInferredCheckoutDetails(
    {
      ...draft,
      projectContact: {
        ...draft.projectContact,
        firstName: value(draft.projectContact.firstName, defaults.firstName),
        lastName: value(draft.projectContact.lastName, defaults.lastName),
        email: defaults.email,
        phone: formatIndianPhone(value(draft.projectContact.phone, defaults.phone)),
      },
      shippingInformation: {
        ...draft.shippingInformation,
        address: {
          country: "India",
          addressLine1: value(shippingAddress.addressLine1, defaults.shippingAddress.addressLine1),
          addressLine2: value(shippingAddress.addressLine2, defaults.shippingAddress.addressLine2 ?? ""),
          zip: value(shippingAddress.zip, defaults.shippingAddress.zip),
          city: value(shippingAddress.city, defaults.shippingAddress.city),
          state: value(shippingAddress.state, defaults.shippingAddress.state ?? ""),
        },
      },
      billingInformation: {
        ...draft.billingInformation,
        sameAsCompanyAddress:
          mode === "replace"
            ? defaults.billingSameAsShipping
            : draft.billingInformation.sameAsCompanyAddress,
        entity: value(draft.billingInformation.entity, defaults.billingEntity),
        accountsPayableEmail: defaults.email,
        gstin: value(draft.billingInformation.gstin, defaults.gstin),
        address: {
          country: "India",
          addressLine1: value(billingAddress.addressLine1, defaults.billingAddress.addressLine1),
          addressLine2: value(billingAddress.addressLine2, defaults.billingAddress.addressLine2 ?? ""),
          zip: value(billingAddress.zip, defaults.billingAddress.zip),
          city: value(billingAddress.city, defaults.billingAddress.city),
          state: value(billingAddress.state, defaults.billingAddress.state ?? ""),
        },
      },
    },
    defaults,
  );
}

function hasEnteredCheckoutDetails(draft: CartDraft): boolean {
  const contact = draft.projectContact;
  const shipping = draft.shippingInformation.address;
  const billing = draft.billingInformation;
  return Boolean(
    contact.firstName.trim() ||
      contact.lastName.trim() ||
      contact.phone.trim() ||
      shipping.addressLine1.trim() ||
      shipping.zip.trim() ||
      shipping.city.trim() ||
      shipping.state?.trim() ||
      billing.gstin.trim() ||
      (!billing.sameAsCompanyAddress && billing.address.addressLine1.trim()),
  );
}

function checkoutDetailsDiffer(draft: CartDraft, defaults: CheckoutAccountDefaults): boolean {
  const normalized = (value: string | undefined) =>
    (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const phone = (value: string) => digitsOnly(value).slice(-10);
  const shipping = draft.shippingInformation.address;
  const billing = draft.billingInformation.address;
  return [
    normalized(draft.projectContact.firstName) !== normalized(defaults.firstName),
    normalized(draft.projectContact.lastName) !== normalized(defaults.lastName),
    phone(draft.projectContact.phone) !== phone(defaults.phone),
    normalized(shipping.addressLine1) !== normalized(defaults.shippingAddress.addressLine1),
    normalized(shipping.addressLine2) !== normalized(defaults.shippingAddress.addressLine2),
    normalized(shipping.zip) !== normalized(defaults.shippingAddress.zip),
    normalized(shipping.city) !== normalized(defaults.shippingAddress.city),
    normalized(shipping.state) !== normalized(defaults.shippingAddress.state),
    normalized(draft.billingInformation.gstin) !== normalized(defaults.gstin),
    normalized(draft.billingInformation.entity) !== normalized(defaults.billingEntity),
    draft.billingInformation.sameAsCompanyAddress !== defaults.billingSameAsShipping,
    !draft.billingInformation.sameAsCompanyAddress &&
      normalized(billing.addressLine1) !== normalized(defaults.billingAddress.addressLine1),
  ].some(Boolean);
}

function useAuthenticatedEmail(draft: CartDraft, authenticatedEmail: string): CartDraft {
  const previousEmail = draft.projectContact.email.trim().toLowerCase();
  const billingEmail = draft.billingInformation.accountsPayableEmail.trim().toLowerCase();
  return withInferredCheckoutDetails({
    ...draft,
    projectContact: { ...draft.projectContact, email: authenticatedEmail },
    billingInformation: {
      ...draft.billingInformation,
      accountsPayableEmail:
        !billingEmail || billingEmail === previousEmail
          ? authenticatedEmail
          : draft.billingInformation.accountsPayableEmail,
    },
  });
}

export function BillingShippingStep({
  cartId,
  accountContext,
}: BillingShippingStepProps) {
  const router = useRouter();
  const accountDefaults = accountContext?.defaults;
  const authenticatedEmail = accountContext?.authenticatedEmail;
  const [draft, setDraft] = useState<CartDraft>(() => createDraft(cartId));
  const [isDraftReady, setIsDraftReady] = useState(false);
  const [needsDetailsChoice, setNeedsDetailsChoice] = useState(false);
  const [saveDetailsToAccount, setSaveDetailsToAccount] = useState(true);
  const [isSavingAccount, setIsSavingAccount] = useState(false);
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

      let preparedDraft = withInferredCheckoutDetails(savedDraft);
      if (accountContext) {
        const hasEnteredDetails = hasEnteredCheckoutDetails(savedDraft);
        const shouldChoose =
          accountContext.hasSavedDetails &&
          hasEnteredDetails &&
          checkoutDetailsDiffer(savedDraft, accountContext.defaults);
        const defaultsMode =
          accountContext.hasSavedDetails && !hasEnteredDetails
            ? "replace"
            : "fill-empty";
        preparedDraft = shouldChoose
          ? useAuthenticatedEmail(preparedDraft, accountContext.authenticatedEmail)
          : useAuthenticatedEmail(
              withAccountDefaults(preparedDraft, accountContext.defaults, defaultsMode),
              accountContext.authenticatedEmail,
            );
        setNeedsDetailsChoice(shouldChoose);
      }

      setDraft(preparedDraft);
      writeDraft(cartId, preparedDraft);
      setIsDraftReady(true);
    }, 0);
    return () => window.clearTimeout(loadDraft);
  }, [accountContext, cartId, router]);

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
  // Delivery availability must always be calculated from today's date in India,
  // not from the date on which an older browser draft was first created.
  const deliveryBaseDate = getIndiaCalendarDate();

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

  const useSavedAccountDetails = useCallback(() => {
    if (!accountContext) return;
    const next = useAuthenticatedEmail(
      withAccountDefaults(draft, accountContext.defaults, "replace"),
      accountContext.authenticatedEmail,
    );
    setDraft(next);
    persistCartDraft(next);
    setNeedsDetailsChoice(false);
    setValidationFeedback(null);
  }, [accountContext, draft, persistCartDraft]);

  const keepEnteredDetails = useCallback(() => {
    if (!authenticatedEmail) return;
    const next = useAuthenticatedEmail(draft, authenticatedEmail);
    setDraft(next);
    persistCartDraft(next);
    setNeedsDetailsChoice(false);
    setValidationFeedback(null);
  }, [authenticatedEmail, draft, persistCartDraft]);

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
    Boolean(accountContext) &&
    !needsDetailsChoice &&
    !isSavingAccount &&
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

  const handleNext = async () => {
    if (!isValid) {
      setValidationFeedback(missingMessage ?? "Complete the required fields to continue.");
      trackConfiguratorEvent("checkout_validation_error", {
        cart_id: cartId,
        missing_count: missingLabels.length,
        first_missing: missingLabels[0] ?? null,
      });
      focusFirstMissingField();
      return;
    }

    if (saveDetailsToAccount || !accountContext?.hasSavedDetails) {
      setIsSavingAccount(true);
      setValidationFeedback(null);
      try {
        const response = await fetch("/api/account/checkout-defaults", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contact: draft.projectContact,
            shipping: { address: draft.shippingInformation.address },
            billing: {
              sameAsCompanyAddress: draft.billingInformation.sameAsCompanyAddress,
              entity: draft.billingInformation.entity,
              address: draft.billingInformation.sameAsCompanyAddress
                ? draft.shippingInformation.address
                : draft.billingInformation.address,
              gstin: draft.billingInformation.gstin,
            },
          }),
        });
        const result = (await response.json().catch(() => null)) as
          | { ok?: boolean; message?: string }
          | null;
        if (!response.ok || !result?.ok) {
          throw new Error(result?.message ?? "Your account details could not be saved.");
        }
      } catch (error) {
        setValidationFeedback(
          error instanceof Error ? error.message : "Your account details could not be saved.",
        );
        setIsSavingAccount(false);
        return;
      }
    }

    router.push(`/configurator/cart/${encodeURIComponent(cartId)}/confirmation`);
  };

  const topBar = (
    <ConfiguratorTopBar
      currentStep="delivery"
      backHref={`/configurator/cart/${encodeURIComponent(cartId)}/review`}
      showCart
      productName={getCartProductLabel(draft.items)}
      specReference={`CART-${cartId}`}
      links={getCartJourneyLinks(cartId, draft.items[0]?.productId, draft.items[0]?.id)}
    />
  );

  if (!isDraftReady) {
    return <>{topBar}<div className="flex min-h-[360px] items-center justify-center text-sm text-[var(--text-primary)]/50">Loading delivery details…</div></>;
  }

  if (!accountContext) {
    const deliveryPath = `/configurator/cart/${encodeURIComponent(cartId)}/shipping`;
    const initialEmail = draft.projectContact.email.trim().toLowerCase();
    const lockEmail = isEmailValid(initialEmail);
    return (
      <>
        {topBar}
        <div className="mx-auto flex max-w-xl items-start justify-center py-8 sm:py-12">
          <section className="techpack-surface w-full rounded-[4px] border p-6 sm:p-8">
            <div className="mb-6 text-center">
              <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)]"><ShieldCheck size={22} aria-hidden="true" /></span>
              <p className="mt-4 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">06 / Delivery access</p>
              <h1 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">Sign in/Register</h1>
            </div>
            <CustomerAuthFlow
              next={deliveryPath}
              initialEmail={initialEmail}
              emailLocked={lockEmail}
              allowGoogle={!lockEmail}
              onAuthenticated={() => window.location.assign(deliveryPath)}
            />
          </section>
        </div>
      </>
    );
  }

  if (needsDetailsChoice) {
    return (
      <>
        {topBar}
        <div className="mx-auto flex max-w-2xl items-start justify-center py-8 sm:py-12">
          <section className="techpack-surface w-full rounded-[4px] border p-6 sm:p-8">
            <span className="flex size-11 items-center justify-center rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)]"><CheckCircle2 size={22} aria-hidden="true" /></span>
            <p className="mt-4 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">Saved account details found</p>
            <h1 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">Which delivery details should we use?</h1>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-primary)]/55">You entered checkout details before signing in, and this account already has saved defaults. Nothing will be overwritten until you choose.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={useSavedAccountDetails} className="rounded-[4px] bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white">Use saved account details</button>
              <button type="button" onClick={keepEnteredDetails} className="rounded-[4px] border border-[var(--color-rule)] bg-white px-5 py-3 text-sm font-semibold text-[var(--text-primary)]">Keep details I entered</button>
            </div>
            <p className="mt-4 text-xs text-[var(--text-primary)]/45">Signed in as {accountContext.authenticatedEmail}</p>
          </section>
        </div>
      </>
    );
  }

  return (
    <>
      {topBar}

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

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[4px] border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/5 px-4 py-3 text-sm">
            <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-[var(--color-accent)]" aria-hidden="true" /><span className="text-[var(--text-primary)]/65">Signed in as <strong className="text-[var(--text-primary)]">{accountContext.authenticatedEmail}</strong></span></div>
            <span className="text-xs text-[var(--text-primary)]/45">Saved account details are available for this checkout.</span>
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
                  orderConfirmedDateIso: new Date().toISOString(),
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
                  className={`${INPUT_CLASS} bg-black/[0.025]`}
                  value={draft.projectContact.email}
                  readOnly
                  aria-describedby="verified-email-note"
                />
                <p id="verified-email-note" className="mt-1 text-xs text-[var(--text-primary)]/45">Verified account email. Order access and payment will be linked to this address.</p>
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

          <section className="techpack-panel rounded-[4px] border p-5">
            <label className="flex items-start gap-3 text-sm text-[var(--text-primary)]/75">
              <input
                type="checkbox"
                checked={saveDetailsToAccount || !accountContext.hasSavedDetails}
                disabled={!accountContext.hasSavedDetails}
                onChange={(event) => setSaveDetailsToAccount(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
              />
              <span>
                <strong className="block font-medium text-[var(--text-primary)]">{accountContext.hasSavedDetails ? "Save these details to my account" : "Save these details to my new account"}</strong>
                <span className="mt-0.5 block text-xs leading-relaxed text-[var(--text-primary)]/50">{accountContext.hasSavedDetails ? "Keep this checked to update your default contact, shipping and optional GST billing details. Uncheck it to use these details for this order only." : "Your first completed delivery details become the defaults for future orders. The paid order will still keep its own immutable snapshot."}</span>
              </span>
            </label>
          </section>
        </div>

        <div className="lg:sticky lg:top-36 lg:self-start">
          <CartSummarySidebar
            subtotal={totals.subtotal}
            volumeDiscount={totals.volumeDiscount}
            rushFee={totals.rushFee}
            shippingFee={totals.shippingFee}
            gst={totals.gst}
            delivery={deliveryLabel}
            total={totals.total}
            onNext={handleNext}
            nextLabel={isSavingAccount ? "Saving account details…" : "Continue to review"}
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
