import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  notFound: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}));

vi.mock("@/components/configurator/ConfigureClient", () => ({
  default: ({
    configId,
    product,
  }: {
    configId: string;
    product: { id: string; name: string };
  }) => (
    <div data-config-id={configId} data-product-id={product.id}>
      {product.name}
    </div>
  ),
}));

import ConfiguratorBuildPage from "./page";

describe("ConfiguratorBuildPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.notFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
    mocks.redirect.mockImplementation((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    });
  });

  it("returns 404 for an unknown product before creating a draft redirect", async () => {
    await expect(
      ConfiguratorBuildPage({
        params: Promise.resolve({ configId: "not-a-real-product" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mocks.notFound).toHaveBeenCalledOnce();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });


  it("preserves the existing cart id while creating a new line draft", async () => {
    await expect(
      ConfiguratorBuildPage({
        params: Promise.resolve({ configId: "regular-fit-tee-200gsm" }),
        searchParams: Promise.resolve({ cartId: "cart-123" }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT:");

    const redirectUrl = String(mocks.redirect.mock.calls[0]?.[0]);
    expect(redirectUrl).toContain("cartId=cart-123");
    expect(redirectUrl).toMatch(/draftId=[0-9a-f-]+/i);
  });

  it("passes the validated catalog product to the configurator", async () => {
    const page = await ConfiguratorBuildPage({
      params: Promise.resolve({ configId: "regular-fit-tee-200gsm" }),
      searchParams: Promise.resolve({ draftId: "draft-1" }),
    });
    const html = renderToStaticMarkup(page);

    expect(mocks.notFound).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(html).toContain('data-config-id="regular-fit-tee-200gsm"');
    expect(html).toContain('data-product-id="regular-fit-tee-200gsm"');
    expect(html).toContain("Classic T-Shirt");
  });
});
