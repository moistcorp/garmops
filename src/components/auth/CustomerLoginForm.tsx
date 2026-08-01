"use client";

import CustomerAuthFlow from "./CustomerAuthFlow";

/** Backwards-compatible export for integrations that still import this name. */
export default function CustomerLoginForm({ next }: { next: string }) {
  return <CustomerAuthFlow next={next} />;
}
