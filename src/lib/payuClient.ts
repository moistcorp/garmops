"use client";

const PAYU_TEST_URL = "https://test.payu.in/_payment";
const PAYU_PRODUCTION_URL = "https://secure.payu.in/_payment";

export type PayuCheckoutFields = Record<string, string>;

function getPayuCheckoutUrl(): string {
  return (
    process.env.NEXT_PUBLIC_PAYU_BASE_URL ??
    (process.env.NODE_ENV === "production"
      ? PAYU_PRODUCTION_URL
      : PAYU_TEST_URL)
  );
}

/**
 * Sends a browser POST directly to PayU Hosted Checkout. The merchant salt
 * never reaches this function; callers receive only the server-generated hash.
 */
export function submitPayuCheckout(fields: PayuCheckoutFields): void {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = getPayuCheckoutUrl();
  form.acceptCharset = "UTF-8";
  form.hidden = true;

  Object.entries(fields).forEach(([name, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
}
