import { describe, expect, it } from "vitest";

import { attachmentContentDisposition } from "./downloadSafety";

describe("private download response safety", () => {
  it("always produces an attachment disposition", () => {
    expect(attachmentContentDisposition("artwork.svg")).toBe(
      "attachment; filename=\"artwork.svg\"; filename*=UTF-8''artwork.svg",
    );
  });

  it("cannot inject response headers through a filename", () => {
    const disposition = attachmentContentDisposition(
      "quote\";\r\nX-Evil: yes.svg",
    );

    expect(disposition.startsWith("attachment; ")).toBe(true);
    expect(disposition).not.toContain("\r");
    expect(disposition).not.toContain("\n");
    expect(disposition).not.toContain('filename="quote";');
    expect(disposition).toContain("filename*=UTF-8''");
  });

  it("emits an ASCII fallback and RFC 5987 value for Unicode", () => {
    const disposition = attachmentContentDisposition("कला प्रमाण.svg");

    expect(disposition).toContain('filename="___ ______.svg"');
    expect(disposition).toContain("%E0%A4%95");
  });
});
