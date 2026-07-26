import { getDeliveryOptions } from "./delivery";

export type DeliveryFeasibilityStatus = "unknown" | "comfortable" | "tight" | "rush" | "review";

export interface DeliveryFeasibility {
  status: DeliveryFeasibilityStatus;
  label: string;
  detail: string;
}

function atStartOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getDeliveryFeasibility(
  targetDateIso: string | undefined,
  extraLeadTimeDays = 0,
  baseDate = new Date()
): DeliveryFeasibility {
  if (!targetDateIso) {
    return {
      status: "unknown",
      label: "Target date not set",
      detail: "Add a required-by date to check timing before checkout.",
    };
  }

  const target = atStartOfDay(new Date(`${targetDateIso}T12:00:00`));
  if (Number.isNaN(target.getTime())) {
    return { status: "unknown", label: "Check target date", detail: "Choose a valid date." };
  }

  const options = getDeliveryOptions(baseDate, extraLeadTimeDays);
  const rush = atStartOfDay(options.rush);
  const standard = atStartOfDay(options.standard);
  const comfortable = new Date(standard);
  comfortable.setDate(comfortable.getDate() + 7);

  if (target < rush) {
    return {
      status: "review",
      label: "Manual feasibility review",
      detail: "This date is earlier than the current rush estimate. Reserve only after speaking with the team.",
    };
  }
  if (target < standard) {
    return {
      status: "rush",
      label: "Rush review required",
      detail: "The target may be possible with rush production and final artwork approval.",
    };
  }
  if (target < comfortable) {
    return {
      status: "tight",
      label: "Tight but workable",
      detail: "Keep artwork and approvals ready to protect this target date.",
    };
  }
  return {
    status: "comfortable",
    label: "Comfortable timeline",
    detail: "The current standard estimate leaves useful approval time.",
  };
}
