const ONES = [
  "Zero",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
] as const;

const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"] as const;

function underThousand(value: number): string {
  const parts: string[] = [];
  let remainder = value;
  if (remainder >= 100) {
    parts.push(`${ONES[Math.floor(remainder / 100)]} Hundred`);
    remainder %= 100;
  }
  if (remainder >= 20) {
    parts.push(TENS[Math.floor(remainder / 10)]);
    remainder %= 10;
  }
  if (remainder > 0) parts.push(ONES[remainder]);
  return parts.join(" ");
}

function indianNumber(value: number): string {
  if (value === 0) return ONES[0];
  const parts: string[] = [];
  let remainder = value;
  if (remainder >= 10_000_000) {
    parts.push(`${indianNumber(Math.floor(remainder / 10_000_000))} Crore`);
    remainder %= 10_000_000;
  }
  if (remainder >= 100_000) {
    parts.push(`${underThousand(Math.floor(remainder / 100_000))} Lakh`);
    remainder %= 100_000;
  }
  if (remainder >= 1_000) {
    parts.push(`${underThousand(Math.floor(remainder / 1_000))} Thousand`);
    remainder %= 1_000;
  }
  if (remainder > 0) parts.push(underThousand(remainder));
  return parts.join(" ");
}

/** Formats non-negative paise using Indian numbering and exact paise. */
export function amountInWords(totalPaise: number): string {
  const normalized = Number.isFinite(totalPaise) ? Math.trunc(totalPaise) : 0;
  const sign = normalized < 0 ? "Minus " : "";
  const absolute = Math.abs(normalized);
  const rupees = Math.floor(absolute / 100);
  const paise = absolute % 100;
  const paiseWords = paise > 0 ? ` and ${indianNumber(paise)} Paise` : "";
  return `INR ${sign}${indianNumber(rupees)}${paiseWords} Only`;
}
