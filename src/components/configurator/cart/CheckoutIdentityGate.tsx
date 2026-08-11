"use client";

import { LoaderCircle, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import CustomerAuthFlow from "@/components/auth/CustomerAuthFlow";
import {
  ConfiguratorTopBar,
  getCartJourneyLinks,
  getCartProductLabel,
} from "@/components/configurator/ConfiguratorTopBar";
import { createClient } from "@/lib/supabase/client";

import { ConfirmationStep } from "./ConfirmationStep";
import { createDraft, readDraft, type CartDraft } from "./cartDraft";

export interface CheckoutIdentityGateProps {
  cartId: string;
  authenticatedEmail?: string | null;
  paymentOutcome?: "failure" | "pending";
}

export function CheckoutIdentityGate({
  cartId,
  authenticatedEmail,
  paymentOutcome,
}: CheckoutIdentityGateProps) {
  const [draft, setDraft] = useState<CartDraft>(() => createDraft(cartId));
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const loadDraft = window.setTimeout(() => {
      setDraft(readDraft(cartId));
      setDraftLoaded(true);
    }, 0);

    return () => window.clearTimeout(loadDraft);
  }, [cartId]);

  const destination = `/configurator/cart/${encodeURIComponent(cartId)}/confirmation`;
  const deliveryEmail = draft.projectContact.email.trim().toLowerCase();
  const signedInEmail = authenticatedEmail?.trim().toLowerCase() ?? "";

  const topBar = (
    <ConfiguratorTopBar
      currentStep="review"
      backHref={`/configurator/cart/${encodeURIComponent(cartId)}/shipping`}
      showCart
      productName={getCartProductLabel(draft.items)}
      specReference={`CART-${cartId}`}
      links={getCartJourneyLinks(
        cartId,
        draft.items[0]?.productId,
        draft.items[0]?.id,
      )}
    />
  );

  if (!draftLoaded) {
    return (
      <>
        {topBar}
        <div
          className="flex min-h-[360px] items-center justify-center"
          role="status"
          aria-live="polite"
        >
          <LoaderCircle
            className="animate-spin text-(--color-accent)"
            size={28}
            aria-hidden="true"
          />
          <span className="sr-only">Loading secure account access</span>
        </div>
      </>
    );
  }

  if (signedInEmail && (!deliveryEmail || signedInEmail === deliveryEmail)) {
    return <ConfirmationStep cartId={cartId} paymentOutcome={paymentOutcome} />;
  }

  const signOutAndContinue = async () => {
    setSigningOut(true);
    try {
      await createClient().auth.signOut();
    } finally {
      window.location.assign(destination);
    }
  };

  return (
    <>
      {topBar}

      <div className="mx-auto flex min-h-[560px] max-w-xl items-start justify-center py-8 sm:py-12">
        <section className="techpack-surface w-full rounded-sm border p-6 sm:p-8">
          <div className="mb-6 text-center">
            <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-(--color-accent)/10 text-(--color-accent)">
              <ShieldCheck size={22} aria-hidden="true" />
            </span>
            <p className="mt-4 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-(--color-accent)">
              07 / Secure review access
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-(--text-primary)">
              {signedInEmail
                ? "Use the order email to continue"
                : "Verify your email to review your order"}
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-(--text-primary)/55">
              {signedInEmail
                ? "The signed-in account and the delivery email must match before payment."
                : "Verify the delivery email below. Existing customers return to their account; a new customer account is created automatically after OTP verification."}
            </p>
          </div>

          {deliveryEmail ? (
            <div className="mb-5 rounded-sm border border-(--color-accent)/20 bg-(--color-accent)/5 px-4 py-3 text-sm">
              <p className="text-xs text-(--text-primary)/50">Order email</p>
              <p className="mt-0.5 font-medium text-(--text-primary)">
                {deliveryEmail}
              </p>
              <Link
                href={`/configurator/cart/${encodeURIComponent(cartId)}/shipping`}
                className="mt-2 inline-flex text-xs font-semibold text-(--color-accent) hover:underline"
              >
                Change delivery email
              </Link>
            </div>
          ) : null}

          {signedInEmail ? (
            <div className="space-y-4">
              <div className="rounded-sm border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                You are signed in as <strong>{signedInEmail}</strong>, but this
                order uses <strong>{deliveryEmail || "another email"}</strong>.
              </div>
              <button
                type="button"
                onClick={signOutAndContinue}
                disabled={signingOut}
                className="min-h-11 w-full rounded-sm bg-(--color-accent) px-6 py-3 text-sm font-medium text-white disabled:opacity-60"
              >
                {signingOut ? "Signing out…" : "Sign out and verify order email"}
              </button>
            </div>
          ) : (
            <CustomerAuthFlow
              next={destination}
              initialEmail={deliveryEmail}
              emailLocked={Boolean(deliveryEmail)}
              allowGoogle={false}
              onAuthenticated={(next) => window.location.assign(next)}
            />
          )}

        </section>
      </div>
    </>
  );
}
