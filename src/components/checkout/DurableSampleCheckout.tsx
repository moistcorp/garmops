"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import {
  AddressForm,
  getAddressMissingFields,
  type Address,
} from "@/components/configurator/cart/AddressForm";
import { submitPayuCheckout } from "@/lib/payuClient";
import { useCartStore } from "@/lib/store";
import { calculateTaxPaise, gstRateForProduct } from "@/lib/tax";

const inputClass =
  "techpack-control w-full rounded-sm border px-4 py-3 text-sm transition-colors focus:!border-(--color-accent) focus:outline-none";
const labelClass =
  "mb-1.5 block text-xs font-medium uppercase tracking-wide text-(--text-primary)/50";
const SAMPLE_CHECKOUT_IDEMPOTENCY_KEY =
  "garmops-durable-sample-checkout-idempotency";

export type SampleCheckoutDefaults = Readonly<{
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  deliveryAddress: Address;
}>;

type SubmitResponse = {
  error?: string;
  order?: {
    checkoutPaymentAttemptId: string | null;
    alreadyFinalized: boolean;
    orderId?: string | null;
    orderNumber?: string | null;
    subtotalPaise: number;
    taxPaise: number;
    totalPaise: number;
  };
};

type InitiateResponse = {
  error?: string;
  checkoutUrl?: string;
  fields?: Record<string, string>;
};

function rupees(valuePaise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(valuePaise / 100);
}

function cartSignature(
  items: ReadonlyArray<{ productSlug: string; size: string; quantity: number }>,
): string {
  return JSON.stringify(
    items
      .map((item) => ({
        productSlug: item.productSlug,
        size: item.size,
        quantity: item.quantity,
      }))
      .sort((left, right) =>
        `${left.productSlug}:${left.size}`.localeCompare(
          `${right.productSlug}:${right.size}`,
        ),
      ),
  );
}

function durableIdempotencyKey(signature: string): string {
  try {
    const stored = window.sessionStorage.getItem(
      SAMPLE_CHECKOUT_IDEMPOTENCY_KEY,
    );
    if (stored) {
      const parsed = JSON.parse(stored) as {
        key?: unknown;
        signature?: unknown;
      };
      if (
        typeof parsed.key === "string" &&
        typeof parsed.signature === "string" &&
        parsed.signature === signature
      ) {
        return parsed.key;
      }
    }
  } catch {
    // A fresh key remains safe when session storage is unavailable.
  }

  const key = crypto.randomUUID();
  try {
    window.sessionStorage.setItem(
      SAMPLE_CHECKOUT_IDEMPOTENCY_KEY,
      JSON.stringify({ key, signature }),
    );
  } catch {
    // The database still protects duplicate clicks during this mounted session.
  }
  return key;
}

function checkoutSignature(
  items: ReadonlyArray<{ productSlug: string; size: string; quantity: number }>,
  form: { firstName: string; lastName: string; email: string; phone: string; orderNotes: string },
  address: Address,
): string {
  return JSON.stringify({ cart: cartSignature(items), form, address });
}

export default function DurableSampleCheckout({
  defaults,
}: {
  defaults: SampleCheckoutDefaults;
}) {
  const { items, total, hasHydrated } = useCartStore();
  const cartTotalRupees = total();
  const taxPaise = items.reduce((sum, item) => {
    const unitPricePaise = Math.round((item.price ?? 0) * 100);
    const taxablePaise = unitPricePaise * item.quantity;
    return sum + calculateTaxPaise(taxablePaise, gstRateForProduct(item.productSlug, unitPricePaise));
  }, 0);
  const displayedTotalPaise = cartTotalRupees * 100 + taxPaise;

  const idempotencyKey = useRef<string | null>(null);
  const idempotencySignature = useRef<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [savedOrder, setSavedOrder] = useState<SubmitResponse["order"] | null>(
    null,
  );
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [form, setForm] = useState({
    firstName: defaults.firstName,
    lastName: defaults.lastName,
    email: defaults.email,
    phone: defaults.phone.replace(/^\+91/, ""),
    orderNotes: "",
  });
  const [deliveryAddress, setDeliveryAddress] = useState<Address>(
    defaults.deliveryAddress,
  );

  async function submitOrder() {
    if (loading || savedOrder) return;
    if (!form.firstName.trim() || !form.email.trim() || !form.phone.trim()) {
      setError("Please fill in all required contact fields.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    const normalizedPhone = form.phone
      .replace(/\D/g, "")
      .replace(/^91(?=[6-9][0-9]{9}$)/, "");
    if (!/^[6-9][0-9]{9}$/.test(normalizedPhone)) {
      setError("Please enter a valid 10-digit Indian mobile number.");
      return;
    }
    const missingAddressFields = getAddressMissingFields(deliveryAddress);
    if (missingAddressFields.length) {
      setError(`Please enter a valid ${missingAddressFields[0].label}.`);
      return;
    }
    if (!acceptedTerms) {
      setError("Accept the catalogue sample terms before continuing.");
      return;
    }

    const signature = checkoutSignature(items, form, deliveryAddress);
    if (idempotencySignature.current !== signature) {
      idempotencyKey.current = null;
      idempotencySignature.current = signature;
    }
    idempotencyKey.current ??= durableIdempotencyKey(signature);
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/orders/samples/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            productSlug: item.productSlug,
            size: item.size,
            quantity: item.quantity,
          })),
          contact: {
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim() || undefined,
            email: form.email.trim().toLowerCase(),
            phone: `+91${normalizedPhone}`,
          },
          shipping: {
            recipientName:
              `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
            address: deliveryAddress,
          },
          orderNotes: form.orderNotes.trim() || undefined,
          acceptedTerms: true,
          idempotencyKey: idempotencyKey.current,
        }),
      });
      const body = (await response.json()) as SubmitResponse;
      if (!response.ok || !body.order) {
        throw new Error(body.error ?? "The sample order could not be saved.");
      }

      setSavedOrder(body.order);
      if (body.order.alreadyFinalized && body.order.orderNumber) {
        window.location.assign(`/account/orders/${encodeURIComponent(body.order.orderNumber)}`);
        return;
      }
      if (!body.order.checkoutPaymentAttemptId) {
        throw new Error("Secure payment could not be prepared.");
      }
      const paymentResponse = await fetch("/api/payments/payu/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkoutPaymentAttemptId: body.order.checkoutPaymentAttemptId,
        }),
      });
      const payment = (await paymentResponse.json()) as InitiateResponse;
      if (!paymentResponse.ok || !payment.checkoutUrl || !payment.fields) {
        throw new Error(
          payment.error ??
            "The checkout is prepared, but secure payment could not be opened.",
        );
      }
      try {
        window.sessionStorage.removeItem(SAMPLE_CHECKOUT_IDEMPOTENCY_KEY);
      } catch {
        // The prepared database checkout is authoritative even if cleanup is blocked.
      }
      await submitPayuCheckout(payment.fields, payment.checkoutUrl);
    } catch (submissionError) {
      setSavedOrder(null);
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "The sample order could not be submitted.",
      );
      setLoading(false);
    }
  }

  if (!hasHydrated) {
    return (
      <div className="techpack-canvas min-h-[70vh] animate-pulse px-4 py-10 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 h-9 w-64 rounded-sm bg-[#ECE7DF]" />
          <div className="grid gap-8 lg:grid-cols-3 lg:gap-12">
            <div className="techpack-panel h-64 rounded-sm border lg:col-span-2" />
            <div className="techpack-panel h-56 rounded-sm border" />
          </div>
        </div>
      </div>
    );
  }

  if (!items.length && !savedOrder) {
    return (
      <div className="techpack-canvas flex min-h-[70vh] items-center justify-center px-4 py-16 text-center sm:px-6 sm:py-24">
        <div className="techpack-surface w-full max-w-lg rounded-sm border p-8">
          <h1 className="text-3xl font-bold tracking-tight">Nothing to checkout</h1>
          <p className="mt-3 text-sm leading-relaxed text-black/50">
            Add catalogue samples first. Your checkout will be prepared securely before PayU opens, and the order will be created only after verified payment.
          </p>
          <Link
            href="/products"
            className="mt-7 inline-block rounded-sm bg-(--color-accent) px-6 py-3 text-sm font-medium text-white"
          >
            Browse samples
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="techpack-canvas min-h-[70vh] px-4 py-10 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 sm:mb-12">
          <p className="text-xs uppercase tracking-[0.18em] text-(--color-accent)">
            Durable sample checkout
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Catalogue sample order
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-black/50">
            Your products, prices, delivery address, and payment attempt are saved before you leave for PayU. The order number is created only after PayU verifies full payment.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3 lg:gap-12">
          <form
            id="sample-checkout-details"
            className="flex flex-col gap-8 lg:col-span-2"
            onSubmit={(event) => {
              event.preventDefault();
              void submitOrder();
            }}
          >
            <section className="techpack-panel rounded-sm border p-5 sm:p-7">
              <p className="mb-5 text-xs font-medium uppercase tracking-widest text-(--text-primary)/40">
                Account and contact
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="sample-first-name" className={labelClass}>
                    First name *
                  </label>
                  <input
                    id="sample-first-name"
                    value={form.firstName}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        firstName: event.target.value,
                      }))
                    }
                    className={inputClass}
                    autoComplete="given-name"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="sample-last-name" className={labelClass}>
                    Last name
                  </label>
                  <input
                    id="sample-last-name"
                    value={form.lastName}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        lastName: event.target.value,
                      }))
                    }
                    className={inputClass}
                    autoComplete="family-name"
                  />
                </div>
                <div>
                  <label htmlFor="sample-email" className={labelClass}>
                    Email *
                  </label>
                  <input
                    id="sample-email"
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    className={inputClass}
                    autoComplete="email"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="sample-phone" className={labelClass}>
                    Phone *
                  </label>
                  <div className="flex">
                    <span className="techpack-control rounded-l-[4px] border border-r-0 px-4 py-3 text-sm text-black/50">
                      +91
                    </span>
                    <input
                      id="sample-phone"
                      type="tel"
                      value={form.phone}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          phone: event.target.value,
                        }))
                      }
                      className="techpack-control min-w-0 flex-1 rounded-l-[4px] border px-4 py-3 text-sm focus:!border-(--color-accent) focus:outline-none"
                      autoComplete="tel-national"
                      required
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="techpack-panel rounded-sm border p-5 sm:p-7">
              <div className="mb-5">
                <p className="text-xs font-medium uppercase tracking-widest text-(--text-primary)/40">
                  Delivery address
                </p>
                <p className="mt-1 text-xs text-(--text-primary)/50">
                  This address becomes the immutable delivery and billing snapshot for this sample purchase. Shipping is free.
                </p>
              </div>
              <AddressForm
                idPrefix="sample-checkout-address"
                showCountry={false}
                value={deliveryAddress}
                onChange={setDeliveryAddress}
              />
            </section>

            <section className="techpack-panel rounded-sm border p-5 sm:p-7">
              <label htmlFor="sample-notes" className={labelClass}>
                Order notes
              </label>
              <textarea
                id="sample-notes"
                value={form.orderNotes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    orderNotes: event.target.value,
                  }))
                }
                maxLength={2_000}
                rows={4}
                className={`${inputClass} resize-y`}
                placeholder="Delivery instructions or sample evaluation notes"
              />
              <label className="mt-5 flex items-start gap-3 text-sm leading-relaxed text-black/60">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(event) => setAcceptedTerms(event.target.checked)}
                  className="mt-1 h-4 w-4"
                />
                <span>
                  I confirm these are catalogue evaluation samples. Current
                  product availability and server-calculated prices apply at
                  submission, and full payment is required.
                </span>
              </label>
            </section>

            {error ? (
              <div
                role="alert"
                className="rounded-sm border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
                {savedOrder ? (
                  <div className="mt-3">
                    <Link
                      href={savedOrder.orderNumber ? `/account/orders/${encodeURIComponent(savedOrder.orderNumber)}` : "/account/orders"}
                      className="font-semibold underline"
                    >
                      Open saved order {savedOrder.orderNumber ?? "order"}
                    </Link>
                  </div>
                ) : null}
              </div>
            ) : null}
          </form>

          <aside className="flex flex-col gap-4">
            <div className="techpack-surface flex flex-col gap-4 rounded-sm border p-6 lg:sticky lg:top-28">
              <p className="text-sm font-semibold">Order summary</p>
              <div className="flex flex-col gap-3 border-t border-[#ECE7DF] pt-4">
                {items.map((item) => (
                  <div
                    key={`${item.id}-${item.size}`}
                    className="flex justify-between gap-4 text-xs"
                  >
                    <span className="leading-snug text-(--text-primary)/60">
                      {item.name} ({item.size}) ×{item.quantity}
                    </span>
                    <span className="shrink-0 font-medium">
                      {rupees(item.price * item.quantity * 100)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2 border-t border-[#ECE7DF] pt-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-(--text-primary)/50">Subtotal</span>
                  <span>{rupees(cartTotalRupees * 100)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-(--text-primary)/50">GST (5% / 12% as applicable)</span>
                  <span>{rupees(taxPaise)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-(--text-primary)/50">Shipping</span>
                  <span>Free</span>
                </div>
              </div>
              <div className="flex justify-between border-t border-[#ECE7DF] pt-4 text-base font-bold">
                <span>Total</span>
                <span>{rupees(displayedTotalPaise)}</span>
              </div>
              <button
                type="submit"
                form="sample-checkout-details"
                disabled={loading || Boolean(savedOrder)}
                className="w-full rounded-sm bg-(--color-accent) py-3.5 text-sm font-medium text-white transition-colors hover:bg-(--color-accent-dark) disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? savedOrder
                    ? "Opening secure payment…"
                    : "Preparing payment…"
                  : `Pay ${rupees(displayedTotalPaise)}`}
              </button>
            </div>
            <Link
              href="/cart"
              className="text-center text-xs text-(--text-primary)/40 hover:text-(--text-primary)"
            >
              Back to cart
            </Link>
          </aside>
        </div>
      </div>
    </div>
  );
}
