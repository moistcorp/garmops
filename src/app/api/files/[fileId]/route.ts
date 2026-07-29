import { NextRequest, NextResponse } from "next/server";

import {
  authenticateFileApi,
  hasExpectedOrigin,
  jsonError,
  privateUploadsAvailable,
} from "@/lib/r2/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ fileId: string }>;
};

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!privateUploadsAvailable()) {
    return jsonError("Private file management is unavailable", 503);
  }
  if (!hasExpectedOrigin(request)) {
    return jsonError("Invalid request origin", 403);
  }

  const auth = await authenticateFileApi();
  if (!auth.ok) return auth.response;

  const { fileId } = await context.params;
  const { data, error } = await auth.supabase.rpc("soft_delete_file", {
    p_file_id: fileId,
  });
  if (error || !data) {
    return jsonError("File not found", 404);
  }

  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
