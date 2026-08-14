import { NextResponse } from "next/server";
import { clearMedusaToken, medusaRequest } from "@/lib/medusa/client";
export async function GET(request: Request) { try { await medusaRequest("/auth/session", { method: "DELETE", actor: "customer" }); } catch {} await clearMedusaToken("customer"); return NextResponse.redirect(new URL("/login", request.url)); }
