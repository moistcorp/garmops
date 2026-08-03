import { describe, expect, it } from "vitest";

import { GARMOPS_BRAND } from "@/lib/brand";
import { EMAIL_THEME, renderBrandedEmail } from "./brand";

describe("email branding", () => {
  it("uses the current Garmops logo and technical theme", () => {
    const email = renderBrandedEmail({
      preheader: "Reservation confirmed",
      eyebrow: "Payment / Verified",
      title: "Your Garmops reservation is confirmed",
      bodyHtml: "<p>Your saved order has been updated.</p>",
      action: {
        label: "View order",
        url: "https://www.garmops.com/account/orders/ORD-1",
      },
    });

    expect(email).toContain(`src="${GARMOPS_BRAND.logoUrl}"`);
    expect(email).toContain(EMAIL_THEME.accent);
    expect(email).toContain("border-radius: 4px");
    expect(email).not.toContain("GARMOPS<span");
    expect(email).not.toContain("#0E7C72");
    expect(email).not.toContain("#59C9BD");
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
