"use client";

const PAYU_TEST_URL = "https://test.payu.in/_payment";
const PAYU_PRODUCTION_URL = "https://secure.payu.in/_payment";
const PAYU_NAVIGATION_TIMEOUT_MS = 15_000;
const ALLOWED_PAYU_ORIGINS = new Set([
  "https://test.payu.in",
  "https://secure.payu.in",
]);

export type PayuCheckoutFields = Record<string, string>;

function getPayuCheckoutUrl(): string {
  return (
    process.env.NEXT_PUBLIC_PAYU_BASE_URL ??
    (process.env.NODE_ENV === "production"
      ? PAYU_PRODUCTION_URL
      : PAYU_TEST_URL)
  );
}

function validateCheckoutUrl(value: string): string {
  const url = new URL(value);
  if (
    !ALLOWED_PAYU_ORIGINS.has(url.origin) ||
    url.pathname !== "/_payment" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error("The PayU checkout address is invalid");
  }
  return url.toString();
}

/**
 * Sends a browser POST directly to PayU Hosted Checkout. The merchant salt
 * never reaches this function; callers receive only the server-generated hash.
 *
 * The form remains attached and uses the native prototype submit method. This
 * avoids browser/extension overrides of form.submit and Chromium cases where a
 * display:none form silently fails to begin a cross-site navigation.
 */
export function submitPayuCheckout(
  fields: PayuCheckoutFields,
  checkoutUrl?: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let action: string;
    try {
      action = validateCheckoutUrl(checkoutUrl ?? getPayuCheckoutUrl());
    } catch (error) {
      reject(error instanceof Error ? error : new Error("The PayU checkout address is invalid"));
      return;
    }

    const form = document.createElement("form");
    form.method = "POST";
    form.action = action;
    form.target = "_top";
    form.acceptCharset = "UTF-8";
    form.enctype = "application/x-www-form-urlencoded";
    form.noValidate = true;
    form.setAttribute("aria-hidden", "true");
    Object.assign(form.style, {
      position: "fixed",
      left: "-10000px",
      top: "0",
      width: "1px",
      height: "1px",
      overflow: "hidden",
      opacity: "0",
      pointerEvents: "none",
    });

    Object.entries(fields).forEach(([name, value]) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = String(value);
      form.appendChild(input);
    });

    document.body.appendChild(form);

    let settled = false;
    let timeoutId: number | undefined;

    const cleanup = (removeForm: boolean) => {
      window.removeEventListener("pagehide", navigationStarted);
      window.removeEventListener("beforeunload", navigationStarted);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      if (removeForm && form.isConnected) form.remove();
    };

    const navigationStarted = () => {
      if (settled) return;
      settled = true;
      cleanup(false);
      resolve();
    };

    window.addEventListener("pagehide", navigationStarted, { once: true });
    window.addEventListener("beforeunload", navigationStarted, { once: true });

    timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup(true);
      reject(
        new Error(
          "PayU did not open in this browser. Disable payment-blocking extensions or try a private window, then retry.",
        ),
      );
    }, PAYU_NAVIGATION_TIMEOUT_MS);

    try {
      // Call the browser's native method directly. This cannot be shadowed by a
      // form control or replaced by a browser extension via form.submit.
      HTMLFormElement.prototype.submit.call(form);
    } catch (error) {
      if (settled) return;
      settled = true;
      cleanup(true);
      reject(
        error instanceof Error
          ? error
          : new Error("The browser blocked the PayU checkout form"),
      );
    }
  });
}
