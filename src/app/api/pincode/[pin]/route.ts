import { NextResponse } from "next/server";

interface PostalApiOffice {
  District?: string;
  State?: string;
}

interface PostalApiResult {
  Status?: string;
  Message?: string;
  PostOffice?: PostalApiOffice[] | null;
}

const STATE_NAME_ALIASES: Record<string, string> = {
  "andaman & nicobar islands": "Andaman and Nicobar Islands",
  "andaman and nicobar islands": "Andaman and Nicobar Islands",
  "dadra & nagar haveli": "Dadra and Nagar Haveli and Daman and Diu",
  "dadra and nagar haveli": "Dadra and Nagar Haveli and Daman and Diu",
  "daman & diu": "Dadra and Nagar Haveli and Daman and Diu",
  "daman and diu": "Dadra and Nagar Haveli and Daman and Diu",
  "dadra and nagar haveli and daman and diu": "Dadra and Nagar Haveli and Daman and Diu",
  "jammu & kashmir": "Jammu and Kashmir",
  "jammu and kashmir": "Jammu and Kashmir",
  "orissa": "Odisha",
  "pondicherry": "Puducherry",
  "nct of delhi": "Delhi",
};

function canonicalStateName(value: string): string {
  return STATE_NAME_ALIASES[value.trim().toLowerCase()] ?? value.trim();
}

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ pin: string }> }
) {
  const { pin } = await context.params;
  if (!/^[1-9][0-9]{5}$/.test(pin)) {
    return NextResponse.json({ error: "Invalid PIN code" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`https://api.postalpincode.in/pincode/${pin}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      next: { revalidate: 60 * 60 * 24 * 30 },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "PIN lookup unavailable" }, { status: 502 });
    }

    const payload = (await response.json()) as PostalApiResult[];
    const result = payload[0];
    const office = result?.PostOffice?.[0];
    const city = office?.District?.trim();
    const rawState = office?.State?.trim();
    const state = rawState ? canonicalStateName(rawState) : undefined;

    if (result?.Status !== "Success" || !city || !state) {
      return NextResponse.json({ error: "PIN code not found" }, { status: 404 });
    }

    return NextResponse.json({ city, state });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return NextResponse.json({ error: "PIN lookup timed out" }, { status: 504 });
    }
    return NextResponse.json({ error: "PIN lookup unavailable" }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
