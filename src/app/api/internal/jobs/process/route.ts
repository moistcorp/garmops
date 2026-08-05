import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { getServerEnvironment } from "@/lib/config/env";
import { finishSystemJobRun, startSystemJobRun } from "@/lib/jobs/health";
import { processIntegrationJobs } from "@/lib/jobs/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorised(request: NextRequest): boolean {
  const configured = getServerEnvironment().CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!configured || !supplied) return false;
  const expected = Buffer.from(configured);
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const runId = await startSystemJobRun({ jobName: "integration_jobs", triggerSource: "cron" });
  try {
    const summary = await processIntegrationJobs();
    const hasPermanentFailure = summary.dead > 0;
    await finishSystemJobRun({
      runId,
      status: hasPermanentFailure ? "failed" : "completed",
      summary,
      error: hasPermanentFailure
        ? `${summary.dead} integration job(s) permanently failed`
        : null,
    });
    return NextResponse.json(
      { ...summary, runId },
      {
        status: hasPermanentFailure ? 500 : 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    const requestId = crypto.randomUUID();
    const message = error instanceof Error ? error.message : "unknown";
    await finishSystemJobRun({ runId, status: "failed", error: message });
    console.error("Integration job processor failed", { requestId, error: message });
    return NextResponse.json(
      { error: "Job processing failed", requestId, runId },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
