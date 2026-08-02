import type { EstimateRecord, EstimateStatus } from "@/lib/pricing/types";

export function deriveEstimateStatus(estimate: Pick<EstimateRecord, "status" | "valid_until">, now = new Date()): EstimateStatus {
  if (estimate.status === "active" && new Date(estimate.valid_until).getTime() <= now.getTime()) return "expired";
  return estimate.status;
}

export function isEstimateCurrent(
  estimate: Pick<EstimateRecord, "status" | "valid_until" | "design_revision">,
  currentRevision: number,
): boolean {
  return deriveEstimateStatus(estimate) === "active" && currentRevision === estimate.design_revision;
}

export function estimateStatusLabel(status: EstimateStatus): string {
  return {
    active: "Estimate ready",
    expired: "Estimate expired",
    superseded: "Previous estimate",
    converted: "Order placed",
    cancelled: "Estimate cancelled",
  }[status];
}

export function estimateFilename(estimateNumber: string): string {
  return `Garmops-Estimate-${estimateNumber}.pdf`;
}
