import { NextRequest } from "next/server";
import { z } from "zod";

import {
  authenticateFileApi,
  hasExpectedOrigin,
  jsonError,
  jsonPrivate,
  privateUploadsAvailable,
} from "@/lib/r2/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ fileId: string }>;
};

const reviewSchema = z
  .object({
    status: z.enum(["clean", "rejected"]),
    note: z.string().trim().min(1).max(500).nullable().optional(),
  })
  .strict();

export async function POST(request: NextRequest, context: RouteContext) {
  if (!privateUploadsAvailable()) {
    return jsonError("Private file review is unavailable", 503);
  }
  if (!hasExpectedOrigin(request)) {
    return jsonError("Invalid request origin", 403);
  }

  const auth = await authenticateFileApi();
  if (!auth.ok) return auth.response;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return jsonError("Invalid review request", 400);
  }
  const review = reviewSchema.safeParse(rawBody);
  if (!review.success) {
    return jsonError("Invalid review request", 400);
  }

  const { fileId } = await context.params;
  const { data, error } = await auth.supabase.rpc("review_file_scan", {
    p_file_id: fileId,
    p_scan_status: review.data.status,
    p_review_note:
      review.data.note ?? (null as unknown as string),
  });
  if (error || !data) {
    return jsonError("File review is not permitted", 403);
  }

  return jsonPrivate({
    fileId,
    scanStatus: review.data.status,
  });
}
