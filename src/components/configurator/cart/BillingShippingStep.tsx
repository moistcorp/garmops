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
  getIndiaCalendarDate,
  getDeliveryOptions,
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
  authNotice?: string;
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
  "techpack-control w-full rounded-sm border px-3 py-2 text-sm text-(--text-primary) placeholder:text-(--text-primary)/40 focus:!border-(--color-accent) focus:outline-none";
const LABEL_CLASS = "mb-1 block text-xs font-medium text-(--text-primary)/70";

function formatIndianPhone(value: string): string {
  let digits = digitsOnly(value);
  if (digits.startsWith("91") && digits.length > 10) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length > 10) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  return digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
}

const FIELD_ID_MAP: Record<string, string> = {
  "contact.firstName": "contact-full-name",
  "contact.lastName": "contact-full-name",
  "contact.email": "contact-email",
  "contact.phone": "contact-phone",
  "shipping.recipientName": "contact-full-name",
  "billing.gstin": "billing-gstin",
  "billing.entity": "billing-entity",
};

function sectionHeading(
  index: string,
  icon: ReactNode,
  title: string,
  description: string
) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <span className="rounded-sm bg-(--color-accent)/10 p-2 text-(--color-accent-dark)">
        {icon}
      </span>
      <div>
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-(--color-accent)">
          {index}
        </p>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-(--text-primary)">
          {title}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-(--text-primary)/55">
          {description}
        </p>
      </div>
    </div>
  );
}

function splitFullName(value: string): Pick<ProjectContact, "firstName" | "lastName"> {
  const normalized = value.replace(/\s+/g, " ").trimStart();
  const firstSpace = normalized.indexOf(" ");
  return firstSpace < 0
    ? { firstName: normalized, lastName: "" }
    : {
        firstName: normalized.slice(0, firstSpace),
        lastName: normalized.slice(firstSpace + 1),
      };
}

function withDefaultDeliverySelection(draft: CartDraft): CartDraft {
  const today = getIndiaCalendarDate();
  const extraLeadTimeDays = draft.items.some((item) => item.colour.type === "custom_dye")
    ? CUSTOM_DYE_EXTRA_LEAD_TIME_DAYS.max
    : 0;
  const selected = draft.selectedDeliveryDateIso
    ? new Date(draft.selectedDeliveryDateIso)
    : undefined;
  if (
    selected &&
    isDeliverySelectionValid(
      draft.deliveryType,
      selected,
      today,
      extraLeadTimeDays,
    )
  ) {
    return draft;
  }
  return {
    ...draft,
    deliveryType: "standard",
    selectedDeliveryDateIso: getDeliveryOptions(today, extraLeadTimeDays).standard.toISOString(),
    orderConfirmedDateIso: new Date().toISOString(),
  };
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
      entity: draft.billingInformation.entity || accountDefaults?.billingEntity || "",
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

function withAuthenticatedEmail(draft: CartDraft, authenticatedEmail: string): CartDraft {
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
  authNotice,
}: BillingShippingStepProps) {
  const router = useRouter();
  const accountDefaults = accountContext?.defaults;
  const authenticatedEmail = accountContext?.authenticatedEmail;
  const [draft, setDraft] = useState<CartDraft>(() => createDraft(cartId));
  const [isDraftReady, setIsDraftReady] = useState(false);
  const [needsDetailsChoice, setNeedsDetailsChoice] = useState(false);
  const [saveDetailsToAccount, setSaveDetailsToAccount] = useState(true);
  const [gstDetailsOpen, setGstDetailsOpen] = useState(false);
  const [showSavedSummary, setShowSavedSummary] = useState(false);
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

      let preparedDraft = withDefaultDeliverySelection(
        withInferredCheckoutDetails(savedDraft),
      );
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
          ? withAuthenticatedEmail(preparedDraft, accountContext.authenticatedEmail)
          : withAuthenticatedEmail(
              withAccountDefaults(preparedDraft, accountContext.defaults, defaultsMode),
              accountContext.authenticatedEmail,
            );
        setNeedsDetailsChoice(shouldChoose);
        setShowSavedSummary(accountContext.hasSavedDetails && !hasEnteredDetails);
      }

      setGstDetailsOpen(Boolean(preparedDraft.billingInformation.gstin));

      setDraft(preparedDraft);
      writeDraft(cartId, preparedDraft);
      setIsDraftReady(true);
    }, 0);
    return () => window.clearTimeout(loadDraft);
  }, [accountContext, cartId, router]);

  const totals = calculateTotals(draft.items, draft.deliveryType);

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
    const next = withAuthenticatedEmail(
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
    const next = withAuthenticatedEmail(draft, authenticatedEmail);
    setDraft(next);
    persistCartDraft(next);
    setNeedsDetailsChoice(false);
    setValidationFeedback(null);
  }, [authenticatedEmail, draft, persistCartDraft]);

  const procurementMissing = getProcurementMissingFields({
    contact: draft.projectContact,
    shipping: draft.shippingInformation,
    billing: draft.billingInformation,
  });
  const gstDetailsValid = !gstDetailsOpen || (
    isGstinValid(draft.billingInformation.gstin) &&
    Boolean(draft.billingInformation.gstin.trim()) &&
    Boolean(draft.billingInformation.entity.trim())
  );
  const missingLabels = useMemo(() => {
    const labels = procurementMissing
      .filter((field) => field.key !== "shipping.recipientName")
      .map((field) => field.label);
    if (gstDetailsOpen && !draft.billingInformation.gstin.trim()) labels.push("GSTIN");
    if (gstDetailsOpen && !draft.billingInformation.entity.trim()) labels.push("legal business name");
    return Array.from(new Set(labels));
  }, [draft.billingInformation.entity, draft.billingInformation.gstin, gstDetailsOpen, procurementMissing]);
  const isValid =
    isDraftReady &&
    Boolean(accountContext) &&
    !needsDetailsChoice &&
    !isSavingAccount &&
    draft.items.length > 0 &&
    procurementMissing.length === 0 &&
    gstDetailsValid;

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
          : gstDetailsOpen && !draft.billingInformation.gstin.trim()
            ? "billing-gstin"
            : gstDetailsOpen && !draft.billingInformation.entity.trim()
              ? "billing-entity"
              : "contact-details";

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
              entity: draft.billingInformation.entity || `${draft.projectContact.firstName} ${draft.projectContact.lastName}`.trim(),
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
    return <>{topBar}<div className="flex min-h-[360px] items-center justify-center text-sm text-(--text-primary)/50">Loading delivery details…</div></>;
  }

  if (!accountContext) {
    const deliveryPath = `/configurator/cart/${encodeURIComponent(cartId)}/shipping`;
    const initialEmail = draft.projectContact.email.trim().toLowerCase();
    return (
      <>
        {topBar}
        <div className="mx-auto max-w-2xl py-8 sm:py-12">
          <div className="mb-6">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-(--color-accent)">Delivery · 06 / 06</p>
            <h1 className="mt-2 text-2xl font-semibold text-(--text-primary)">Delivery details</h1>
            <p className="mt-1 text-sm text-(--text-primary)/55">Tell us where to deliver your order.</p>
          </div>
          {authNotice ? <div className="mb-4"><ActionFeedback tone="info" title={authNotice} /></div> : null}
          <section className="techpack-surface w-full rounded-sm border p-6 sm:p-8">
            {sectionHeading("1 — Contact", <ShieldCheck size={18} aria-hidden="true" />, "Verify your email", "We’ll use this email for secure order access and payment updates.")}
            <CustomerAuthFlow
              next={deliveryPath}
              initialEmail={initialEmail}
              emailLocked={false}
              allowGoogle
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
          <section className="techpack-surface w-full rounded-sm border p-6 sm:p-8">
            <span className="flex size-11 items-center justify-center rounded-full bg-(--color-accent)/10 text-(--color-accent)"><CheckCircle2 size={22} aria-hidden="true" /></span>
            <p className="mt-4 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-(--color-accent)">Saved account details found</p>
            <h1 className="mt-2 text-2xl font-semibold text-(--text-primary)">Which delivery details should we use?</h1>
            <p className="mt-2 text-sm leading-relaxed text-(--text-primary)/55">You entered checkout details before signing in, and this account already has saved defaults. Nothing will be overwritten until you choose.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={useSavedAccountDetails} className="rounded-sm bg-(--color-accent) px-5 py-3 text-sm font-semibold text-white">Use saved account details</button>
              <button type="button" onClick={keepEnteredDetails} className="rounded-sm border border-(--color-rule) bg-white px-5 py-3 text-sm font-semibold text-(--text-primary)">Keep details I entered</button>
            </div>
            <p className="mt-4 text-xs text-(--text-primary)/45">Signed in as {accountContext.authenticatedEmail}</p>
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
            <p className="font-mono text-xs font-medium uppercase tracking-[0.06em] text-(--text-primary)/50">
              {formatSpecCode(`CART-${cartId}`)}
            </p>
            <h1 className="text-2xl font-semibold text-(--text-primary)">
              Delivery details
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-(--text-primary)/55">
              Tell us where to deliver your order.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-(--color-accent)/20 bg-(--color-accent)/5 px-4 py-3 text-sm">
            <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-(--color-accent)" aria-hidden="true" /><span className="text-(--text-primary)/65"><strong className="text-(--text-primary)">{accountContext.authenticatedEmail}</strong> · Verified</span></div>
            <span className="text-xs text-(--text-primary)/45">{accountContext.hasSavedDetails ? "Saved details filled from your account." : "Your details can be saved for next time."}</span>
          </div>

          <section
            id="contact-details"
            className="techpack-panel scroll-mt-16 rounded-sm border p-5"
          >
            {sectionHeading(
              "1 — Contact",
              <UserRound size={18} />,
              "Contact",
              "Who should receive order updates and coordinate the delivery?"
            )}
            {showSavedSummary ? (
              <div className="flex flex-wrap items-start justify-between gap-4 text-sm text-(--text-primary)/70">
                <div>
                  <p className="font-medium text-(--text-primary)">{draft.projectContact.firstName} {draft.projectContact.lastName}</p>
                  <p className="mt-1">{draft.projectContact.email} · Verified</p>
                  <p className="mt-1">+91 {formatIndianPhone(draft.projectContact.phone)}</p>
                </div>
                <button type="button" onClick={() => setShowSavedSummary(false)} className="text-xs font-semibold text-(--color-accent-dark) underline underline-offset-2">Edit</button>
              </div>
            ) : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="contact-full-name" className={LABEL_CLASS}>Full name</label>
                <input id="contact-full-name" autoComplete="name" className={INPUT_CLASS} value={draft.projectContact.firstName ? `${draft.projectContact.firstName} ${draft.projectContact.lastName}` : ""} onChange={(event) => updateContact({ ...draft.projectContact, ...splitFullName(event.target.value) })} />
              </div>
              <div>
                <label htmlFor="contact-email" className={LABEL_CLASS}>
                  Email
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
                <p id="verified-email-note" className="mt-1 text-xs text-(--text-primary)/45">Verified account email. Order access and payment will be linked to this address.</p>
                {draft.projectContact.email &&
                  !isEmailValid(draft.projectContact.email) && (
                    <p className="mt-1 text-xs text-red-600">
                      Enter a valid email.
                    </p>
                  )}
              </div>
              <div>
                <label htmlFor="contact-phone" className={LABEL_CLASS}>
                  Phone number
                </label>
                <div className="flex rounded-sm border border-(--color-control-border) focus-within:!border-(--color-accent)">
                  <span className="flex items-center border-r border-(--color-rule) px-3 text-sm text-(--text-primary)/60">+91</span>
                  <input id="contact-phone" type="tel" inputMode="tel" autoComplete="tel-national" className={`${INPUT_CLASS} !border-0`} placeholder="98765 43210" value={draft.projectContact.phone} onChange={(event) => updateContact({ ...draft.projectContact, phone: formatIndianPhone(event.target.value) })} />
                </div>
                <p className="mt-1 text-xs text-(--text-primary)/45">Used for delivery updates and courier coordination.</p>
                {digitsOnly(draft.projectContact.phone).length >= 10 &&
                  !isIndianPhoneValid(draft.projectContact.phone) && (
                    <p className="mt-1 text-xs text-red-600">
                      Enter a valid 10-digit Indian mobile number.
                    </p>
                  )}
              </div>
            </div>}
          </section>

          <section
            id="shipping-information"
            className="techpack-panel scroll-mt-16 rounded-sm border p-5"
          >
            {sectionHeading(
              "2 — Delivery address",
              <MapPin size={18} />,
              "Delivery address",
              "Where should we deliver this order?"
            )}
            {showSavedSummary ? (
              <div className="text-sm text-(--text-primary)/70">
                <p className="font-medium text-(--text-primary)">{draft.shippingInformation.recipientName}</p>
                {draft.shippingInformation.company ? <p>{draft.shippingInformation.company}</p> : null}
                <p className="mt-1">{draft.shippingInformation.address.addressLine1}</p>
                {draft.shippingInformation.address.addressLine2 ? <p>{draft.shippingInformation.address.addressLine2}</p> : null}
                <p>{draft.shippingInformation.address.city}, {draft.shippingInformation.address.state} {draft.shippingInformation.address.zip}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label htmlFor="delivery-company" className={LABEL_CLASS}>Company / organisation <span className="font-normal text-(--text-primary)/45">Optional</span></label>
                  <input id="delivery-company" autoComplete="organization" className={INPUT_CLASS} value={draft.shippingInformation.company} onChange={(event) => updateShipping({ ...draft.shippingInformation, company: event.target.value })} />
                </div>
                <AddressForm compact showCountry={false} addressLabel="Address" idPrefix="shipping-address" value={draft.shippingInformation.address} onChange={(address) => updateShipping({ ...draft.shippingInformation, address })} />
              </div>
            )}
          </section>

          <section
            id="billing-information"
            className="techpack-panel scroll-mt-16 rounded-sm border p-5"
          >
            {sectionHeading(
              "3 — Billing",
              <ReceiptText size={18} />,
              "Billing",
              "Billing matches delivery by default. GST details are optional."
            )}
            <div className="space-y-5">
              <label className="flex cursor-pointer items-start gap-3 rounded-sm border border-(--color-rule) p-3 text-sm text-(--text-primary)/75">
                <input
                  type="checkbox"
                  checked={draft.billingInformation.sameAsCompanyAddress}
                  onChange={(event) =>
                    updateBilling({
                      ...draft.billingInformation,
                      sameAsCompanyAddress: event.target.checked,
                    })
                  }
                  className="mt-0.5 h-4 w-4 accent-(--color-accent)"
                />
                <span>
                  <strong className="block font-medium text-(--text-primary)">
                    Billing address same as delivery address
                  </strong>
                  <span className="mt-0.5 block text-xs leading-relaxed text-(--text-primary)/50">
                    Uncheck this to enter a different billing address.
                  </span>
                </span>
              </label>

              {!draft.billingInformation.sameAsCompanyAddress && (
                <AddressForm
                  compact
                  showCountry={false}
                  addressLabel="Billing address"
                  idPrefix="billing-address"
                  value={draft.billingInformation.address}
                  onChange={(address) =>
                    updateBilling({ ...draft.billingInformation, address })
                  }
                />
              )}

              <button
                type="button"
                aria-expanded={gstDetailsOpen}
                aria-controls="gst-details"
                onClick={() => {
                  if (gstDetailsOpen) {
                    const contactName = `${draft.projectContact.firstName} ${draft.projectContact.lastName}`.trim();
                    updateBilling({ ...draft.billingInformation, gstin: "", entity: contactName });
                  } else if (!draft.billingInformation.gstin && draft.billingInformation.entity === `${draft.projectContact.firstName} ${draft.projectContact.lastName}`.trim()) {
                    updateBilling({ ...draft.billingInformation, entity: "" });
                  }
                  setGstDetailsOpen((open) => !open);
                }}
                className="text-sm font-semibold text-(--color-accent-dark) underline underline-offset-4"
              >
                {gstDetailsOpen ? "Remove GST details" : "+ Add GST details"}
              </button>

              {gstDetailsOpen ? (
                <div id="gst-details" className="grid gap-4 rounded-sm border border-(--color-rule) p-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="billing-gstin" className={LABEL_CLASS}>GSTIN</label>
                    <input id="billing-gstin" autoComplete="off" className={`${INPUT_CLASS} uppercase`} maxLength={15} placeholder="22AAAAA0000A1Z5" value={draft.billingInformation.gstin} onChange={(event) => updateBilling({ ...draft.billingInformation, gstin: event.target.value.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 15) })} />
                    {draft.billingInformation.gstin.length === 15 && !isGstinValid(draft.billingInformation.gstin) ? <p className="mt-1 text-xs text-red-600">Enter a valid 15-character GSTIN.</p> : null}
                  </div>
                  <div>
                    <label htmlFor="billing-entity" className={LABEL_CLASS}>Legal business name</label>
                    <input id="billing-entity" autoComplete="organization" className={INPUT_CLASS} value={draft.billingInformation.entity} onChange={(event) => updateBilling({ ...draft.billingInformation, entity: event.target.value })} />
                  </div>
                  <p className="text-xs leading-relaxed text-(--text-primary)/50 sm:col-span-2">GSTIN format is checked locally. No GST registry lookup is configured, so enter the legal business name exactly as registered.</p>
                </div>
              ) : null}
            </div>
          </section>

          <section className="techpack-panel rounded-sm border p-5">
            <label className="flex items-start gap-3 text-sm text-(--text-primary)/75">
              <input
                type="checkbox"
                checked={saveDetailsToAccount || !accountContext.hasSavedDetails}
                disabled={!accountContext.hasSavedDetails}
                onChange={(event) => setSaveDetailsToAccount(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-(--color-accent)"
              />
              <span>
                <strong className="block font-medium text-(--text-primary)">{accountContext.hasSavedDetails ? "Save these details to my account" : "Save these details to my new account"}</strong>
                <span className="mt-0.5 block text-xs leading-relaxed text-(--text-primary)/50">{accountContext.hasSavedDetails ? "Keep this checked to update your default contact, shipping and optional GST billing details. Uncheck it to use these details for this order only." : "Your first completed delivery details become the defaults for future orders. The paid order will still keep its own immutable snapshot."}</span>
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
            total={totals.total}
            onNext={handleNext}
            nextLabel={isSavingAccount ? "Saving account details…" : "Review & payment"}
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
