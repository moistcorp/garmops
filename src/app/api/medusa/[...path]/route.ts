import { NextRequest, NextResponse } from "next/server";
import { medusaRequest } from "@/lib/medusa/client";
import { MedusaApiError } from "@/lib/medusa/types";

type Context = { params: Promise<{ path: string[] }> };

const ALLOWED_PROXY_PREFIXES = [
  "/store/garmops/",
  "/store/customers/me",
] as const;

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
  try {
    const result = await medusaRequest(pathname + query, {
      method: request.method,
      body,
      headers: { "x-request-id": request.headers.get("x-request-id") ?? "" },
    });
    return result === null || result === undefined
      ? new NextResponse(null, { status: 204 })
      : NextResponse.json(result);
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