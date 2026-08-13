import { describe, expect, it } from "vitest";
import { extractPdfCompatiblePayload } from "./aiPreview";

describe("Illustrator preview extraction", () => {
  it("extracts the complete embedded PDF payload", () => {
    const source = new TextEncoder().encode("%!PS\n%PDF-1.7\nobject\n%%EOF\ntrailer\n%%EOF\n");
    const payload = extractPdfCompatiblePayload(source);
    expect(payload && new TextDecoder().decode(payload)).toBe("%PDF-1.7\nobject\n%%EOF\ntrailer\n%%EOF");
  });

  it("returns null when an AI file has no PDF-compatible payload", () => {
    expect(extractPdfCompatiblePayload(new TextEncoder().encode("%!PS-Adobe-3.0\n"))).toBeNull();
  });
});
