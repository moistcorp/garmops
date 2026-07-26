const TARGET_DATE_KEY = "garmops:configurator:target-date";
const TARGET_QUANTITY_KEY = "garmops:configurator:target-quantity";

export function readPreferredTargetDate(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(TARGET_DATE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function writePreferredTargetDate(value: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (value) window.sessionStorage.setItem(TARGET_DATE_KEY, value);
    else window.sessionStorage.removeItem(TARGET_DATE_KEY);
    return true;
  } catch {
    return false;
  }
}

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
