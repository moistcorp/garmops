import { describe, expect, it } from "vitest";

import { GARMOPS_BRAND } from "@/lib/brand";
import { EMAIL_THEME, renderBrandedEmail } from "./brand";
import { buildPaymentSuccessEmail } from "./paymentTemplates";

describe("email branding", () => {
  it("uses the current Garmops logo and technical theme", () => {
    const email = buildPaymentSuccessEmail({
      name: "Rahul Singh",
      transactionId: "TEST123",
      amount: "499.00",
      kind: "configurator",
      supportEmail: "hello@garmops.com",
      siteUrl: "https://www.garmops.com/account/orders",
    });

    expect(email.html).toContain(`src="${GARMOPS_BRAND.logoUrl}"`);
    expect(email.html).toContain(EMAIL_THEME.accent);
    expect(email.html).toContain("border-radius: 4px");
    expect(email.html).not.toContain("GARMOPS<span");
    expect(email.html).not.toContain("#0E7C72");
    expect(email.html).not.toContain("#59C9BD");
  });

  it("escapes branded-shell text while retaining approved body markup", () => {
    const email = renderBrandedEmail({
      preheader: "Status <updated>",
      eyebrow: "Order <review>",
      title: "Order <confirmed>",
      bodyHtml: "<p>Approved body</p>",
      action: {
        label: "View <order>",
        url: "https://www.garmops.com/account/orders/ORD-1",
      },
    });

    expect(email).toContain("Order &lt;confirmed&gt;");
    expect(email).toContain("View &lt;order&gt;");
    expect(email).toContain("<p>Approved body</p>");
    expect(email).not.toContain("Order <confirmed>");
  });
});
