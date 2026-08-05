import "server-only";

import { finishSystemJobRun, startSystemJobRun, type SystemJobTrigger } from "@/lib/jobs/health";
import { processIntegrationJobs } from "@/lib/jobs/service";

export async function processIntegrationJobsWithHealth(input?: {
  triggerSource?: SystemJobTrigger;
  triggerUserId?: string | null;
  batchSize?: number;
  workerId?: string;
}) {
  const runId = await startSystemJobRun({
    jobName: "integration_jobs",
    triggerSource: input?.triggerSource ?? "system",
    triggerUserId: input?.triggerUserId ?? null,
  });
  try {
    const summary = await processIntegrationJobs({
      batchSize: input?.batchSize,
      workerId: input?.workerId,
    });
    await finishSystemJobRun({
      runId,
      status: summary.dead > 0 ? "failed" : "completed",
      summary,
      error: summary.dead > 0
        ? `${summary.dead} integration job(s) permanently failed`
        : null,
    });
    return summary;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Integration job processing failed";
    await finishSystemJobRun({ runId, status: "failed", error: message });
    throw error;
  }
}
