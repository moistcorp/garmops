import "server-only";

import { cookies } from "next/headers";
import { getServerEnvironment } from "@/lib/config/env";
import { MedusaApiError, type MedusaRequestOptions } from "./types";

const CUSTOMER_TOKEN_COOKIE = "garmops_medusa_customer";
const STAFF_TOKEN_COOKIE = "garmops_medusa_staff";

function backendOrigin(): string {
  const value = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000";
  return value.replace(/\/$/, "");
}

function cookieName(actor: "customer" | "staff"): string {
  return actor === "staff" ? STAFF_TOKEN_COOKIE : CUSTOMER_TOKEN_COOKIE;
}

export async function medusaToken(actor: "customer" | "staff"): Promise<string | null> {
  return (await cookies()).get(cookieName(actor))?.value ?? null;
}

export async function setMedusaToken(actor: "customer" | "staff", token: string): Promise<void> {
  (await cookies()).set(cookieName(actor), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearMedusaToken(actor: "customer" | "staff"): Promise<void> {
  (await cookies()).set(cookieName(actor), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

function actorForPath(path: string): "customer" | "staff" | "public" {
  if (path.startsWith("/foundry/")) return "staff";
  if (path === "/auth/session" || path.startsWith("/store/garmops/")) return "customer";
  if (path === "/auth/user" || path.startsWith("/auth/user/")) return "staff";
  if (
    path.startsWith("/store/garmops/cart") ||
    path.startsWith("/store/garmops/sample-cart") ||
    path.startsWith("/store/garmops/checkout") ||
    path.startsWith("/store/garmops/designs") ||
    path.startsWith("/store/garmops/files") ||
    path.startsWith("/store/garmops/orders") ||
    path.startsWith("/store/garmops/invoices") ||
    path.includes("/payments/payu/")
  ) return "customer";
  return "public";
}

export async function medusaRequest<T = unknown>(path: string, options: MedusaRequestOptions = {}): Promise<T> {
  const actor = options.actor ?? actorForPath(path);
  const headers = new Headers(options.headers);
  headers.set("accept", "application/json");
  if (options.body !== undefined) headers.set("content-type", "application/json");
  headers.set("x-request-id", headers.get("x-request-id") ?? crypto.randomUUID());
  const publishableKey = process.env.MEDUSA_PUBLISHABLE_API_KEY;
  if (publishableKey) headers.set("x-publishable-api-key", publishableKey);
  const token = options.token ?? (actor === "public" ? null : await medusaToken(actor));
  if (token) headers.set("authorization", `Bearer ${token}`);

  const response = await fetch(`${backendOrigin()}${path.startsWith("/") ? path : `/${path}`}`, {
    ...options,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers,
    credentials: "include",
    cache: "no-store",
  });
  const requestId = response.headers.get("x-request-id");
  const text = await response.text();
  const body = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) {
    const errorBody = body && typeof body === "object" ? body as Record<string, unknown> : {};
    throw new MedusaApiError(response.status, errorBody, requestId);
  }
  return body as T;
}

export function medusaOrigin(): string {
  return backendOrigin();
}

export function frontendOrigin(): string {
  return getServerEnvironment().NEXT_PUBLIC_APP_URL;
}
