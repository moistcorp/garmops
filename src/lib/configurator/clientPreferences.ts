const TARGET_QUANTITY_KEY = "garmops:configurator:target-quantity";

export function readPreferredQuantity(): number | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const parsed = Number(window.sessionStorage.getItem(TARGET_QUANTITY_KEY));
    return Number.isFinite(parsed) && parsed >= 50 ? Math.floor(parsed) : undefined;
  } catch {
    return undefined;
  }
}

export function writePreferredQuantity(value: number): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.sessionStorage.setItem(TARGET_QUANTITY_KEY, String(Math.max(50, Math.floor(value))));
    return true;
  } catch {
    return false;
  }
}
