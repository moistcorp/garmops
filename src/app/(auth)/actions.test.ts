import { beforeEach, describe, expect, it, vi } from "vitest";
import { INITIAL_AUTH_ACTION_STATE } from "@/lib/auth/constants";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  medusaRequest: vi.fn(),
  setMedusaToken: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/config/appSurface", () => ({ isStaffSurface: () => false }));
vi.mock("@/lib/config/featureFlags", () => ({ isFeatureEnabled: () => true }));
vi.mock("@/lib/medusa/client", () => ({
  clearMedusaToken: vi.fn(),
  medusaRequest: mocks.medusaRequest,
  setMedusaToken: mocks.setMedusaToken,
}));

import { verifyCustomerOtpAction } from "./actions";

describe("customer auth actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.medusaRequest.mockResolvedValue({ token: "customer-token" });
  });

  it("returns the configurator destination after OTP verification without a server redirect", async () => {
    const formData = new FormData();
    formData.set("email", "buyer@example.com");
    formData.set("challengeId", "challenge-123");
    formData.set("token", "123456");
    formData.set(
      "next",
      "/configurator/build/regular-fit-tee-200gsm?draftId=draft-123&step=neck-label&afterAuth=add-to-cart",
    );

    const result = await verifyCustomerOtpAction(
      INITIAL_AUTH_ACTION_STATE,
      formData,
    );

    expect(result.status).toBe("success");
    expect(result.destination).toContain("draftId=draft-123");
    expect(result.destination).toContain("step=neck-label");
    expect(mocks.setMedusaToken).toHaveBeenCalledWith(
      "customer",
      "customer-token",
    );
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
