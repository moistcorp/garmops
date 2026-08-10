import { getDeliveryOptions, getIndiaCalendarDate } from "@/lib/configurator/delivery";

export function estimateStaticDispatchDate(mode: "rush" | "standard" | "flexible"): string {
  const options = getDeliveryOptions(getIndiaCalendarDate());
  return (mode === "rush" ? options.rush : options.standard).toISOString();
}
