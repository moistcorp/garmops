import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OrderBar } from "./OrderBar";

describe("order bar configuration handoff", () => {
  it("keeps the post-login save state with the selected configuration", () => {
    const markup = renderToStaticMarkup(
      <OrderBar
        quantity={50}
        onQuantityChange={() => undefined}
        ctaLabel="Continue with standard label →"
        pricingBreakdown={{
          rows: [],
          unitPrice: 535,
          lineSubtotal: 26_750,
          discountPercent: 0,
          discountAmount: 0,
          taxable: 26_750,
          gst: 1_337.5,
          total: 28_087.5,
        }}
        configurationHandoff={{
          stage: "account-verified",
          productName: "Classic T-Shirt",
          colourName: "Classic White",
          quantity: 50,
        }}
      />,
    );

    expect(markup).toContain('data-configuration-handoff="true"');
    expect(markup).toContain("Account verified");
    expect(markup).toContain("Classic T-Shirt · Classic White · 50 pcs");
    expect(markup).toContain("Design saved");
    expect(markup).toContain("Opening sizes…");
  });
});
