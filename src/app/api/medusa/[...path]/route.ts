import { NextRequest, NextResponse } from "next/server";
import { medusaRequest } from "@/lib/medusa/client";
import { MedusaApiError } from "@/lib/medusa/types";

type Context = { params: Promise<{ path: string[] }> };

async function forward(request: NextRequest, context: Context): Promise<NextResponse> {
  const { path } = await context.params;
  const pathname = `/${path.join("/")}`;
  const query = request.nextUrl.search;
  const body = request.method === "GET" || request.method === "HEAD" || request.method === "DELETE"
    ? undefined
    : await request.json().catch(() => undefined);
  try {
    const result = await medusaRequest(pathname + query, {
      method: request.method,
      body,
      actor: pathname.startsWith("/foundry/") ? "staff" : undefined,
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
