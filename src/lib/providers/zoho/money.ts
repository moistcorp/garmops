export function paiseToZohoAmount(paise: number): number {
  if (!Number.isSafeInteger(paise) || paise < 0) {
    throw new Error("Invalid paise amount");
  }
  return Number((paise / 100).toFixed(2));
}

export function zohoAmountToPaise(value: unknown): number {
  const text = typeof value === "number" ? value.toFixed(2) : String(value ?? "").trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
    throw new Error("Invalid Zoho amount");
  }
  const [rupees, decimals = ""] = text.split(".");
  const paise = Number(rupees) * 100 + Number(decimals.padEnd(2, "0"));
  if (!Number.isSafeInteger(paise)) throw new Error("Zoho amount exceeds safe range");
  return paise;
}

export function utcTimestampToIndiaDate(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid payment timestamp");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}


export function grossPaiseToExclusiveRatePaise(
  grossPaise: number,
  taxBasisPoints: number,
): number {
  if (!Number.isSafeInteger(grossPaise) || grossPaise < 0) {
    throw new Error("Invalid gross paise amount");
  }
  if (!Number.isSafeInteger(taxBasisPoints) || taxBasisPoints < 0 || taxBasisPoints > 100_000) {
    throw new Error("Invalid tax basis points");
  }
  const denominator = BigInt(10_000) + BigInt(taxBasisPoints);
  const numerator = BigInt(grossPaise) * BigInt(10_000);
  const rounded = (numerator + denominator / BigInt(2)) / denominator;
  const result = Number(rounded);
  if (!Number.isSafeInteger(result)) throw new Error("Exclusive rate exceeds safe range");
  return result;
}
