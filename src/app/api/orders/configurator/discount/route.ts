import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "Promotional codes are not supported by the current Medusa contract." }, { status: 422 });
}
