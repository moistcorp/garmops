import { NextRequest, NextResponse } from "next/server";
import { medusaRequest } from "@/lib/medusa/client";
import { MedusaApiError } from "@/lib/medusa/types";
import { products } from "@/lib/products";

type Context = { params: Promise<{ path: string[] }> };

const ALLOWED_PROXY_PREFIXES = [
  "/store/garmops/",
  "/store/customers/me",
] as const;

const SUPPORTED_PRODUCT_SLUGS = new Set(products.map((product) => product.slug));

function isSupportedProductSlug(value: unknown): value is string {
  return typeof value === "string" && SUPPORTED_PRODUCT_SLUGS.has(value);
}

function filterCatalogProducts(result: unknown): unknown {
  if (typeof result !== "object" || result === null || !Array.isArray((result as { products?: unknown }).products)) {
    return result;
  }
  const body = result as { products: unknown[] } & Record<string, unknown>;
  return {
    ...body,
    products: body.products.filter((product) => (
      typeof product === "object" &&
      product !== null &&
      isSupportedProductSlug((product as { slug?: unknown }).slug)
    )),
  };
}

function isAllowedProxyPath(pathname: string, segments: string[]): boolean {
  if (segments.some((segment) => segment === "." || segment === "..")) {
    return false;
  }
  return ALLOWED_PROXY_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

async function forward(request: NextRequest, context: Context): Promise<NextResponse> {
  const { path } = await context.params;
  const pathname = `/${path.join("/")}`;
  if (!isAllowedProxyPath(pathname, path)) {
    return NextResponse.json({ code: "PROXY_PATH_NOT_ALLOWED", message: "This endpoint is not exposed through the storefront proxy." }, { status: 404 });
  }
  const query = request.nextUrl.search;
  const body = request.method === "GET" || request.method === "HEAD" || request.method === "DELETE"
    ? undefined
    : await request.json().catch(() => undefined);
  if (
    typeof body === "object" &&
    body !== null &&
    "productSlug" in body &&
    !isSupportedProductSlug((body as { productSlug?: unknown }).productSlug)
  ) {
    return NextResponse.json({ code: "PRODUCT_NOT_AVAILABLE", message: "This product is no longer available." }, { status: 400 });
  }
  try {
    const result = await medusaRequest(pathname + query, {
      method: request.method,
      body,
      headers: { "x-request-id": request.headers.get("x-request-id") ?? "" },
    });
    const filteredResult = pathname === "/store/garmops/catalog" ? filterCatalogProducts(result) : result;
    return filteredResult === null || filteredResult === undefined
      ? new NextResponse(null, { status: 204 })
      : NextResponse.json(filteredResult);
  } catch (error) {
    if (error instanceof MedusaApiError) {
      return NextResponse.json({ ...error.body, message: error.message }, { status: error.status });
    }
    return NextResponse.json({ code: "MEDUSA_UNAVAILABLE", message: "The commerce service is temporarily unavailable." }, { status: 503 });
  }
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const DELETE = forward;
