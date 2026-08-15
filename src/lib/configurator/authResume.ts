import type { AccordionStepId } from "@/components/configurator/ConfiguratorSidebar/ConfiguratorSidebar";

export const CONFIGURATOR_AUTH_RESUME_PARAM = "afterAuth";

export type ConfiguratorAuthResumeIntent = "add-to-cart" | "save-design";

function buildPath(configId: string, params: URLSearchParams): string {
  const query = params.toString();
  const pathname = `/configurator/build/${encodeURIComponent(configId)}`;
  return query ? `${pathname}?${query}` : pathname;
}

export function configuratorAuthReturnPath(
  configId: string,
  search: string,
  step: AccordionStepId,
  intent: ConfiguratorAuthResumeIntent,
): string {
  const params = new URLSearchParams(search);
  params.set("step", step);
  params.set(CONFIGURATOR_AUTH_RESUME_PARAM, intent);
  return buildPath(configId, params);
}

export function configuratorPathWithoutAuthResume(
  configId: string,
  search: string,
): string {
  const params = new URLSearchParams(search);
  params.delete(CONFIGURATOR_AUTH_RESUME_PARAM);
  return buildPath(configId, params);
}

export function parseConfiguratorAuthResume(
  value: string | null,
): ConfiguratorAuthResumeIntent | null {
  return value === "add-to-cart" || value === "save-design" ? value : null;
}
