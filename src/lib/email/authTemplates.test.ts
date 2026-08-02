import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { GARMOPS_BRAND } from "@/lib/brand";

const templateDirectory = join(process.cwd(), "supabase", "templates");

function readTemplate(name: string) {
  return readFileSync(join(templateDirectory, name), "utf8");
}

describe("Supabase authentication email templates", () => {
  it.each([
    "confirmation.html",
    "magic-link.html",
    "recovery.html",
    "invite.html",
  ])("uses the current Garmops identity in %s", (templateName) => {
    const template = readTemplate(templateName);

    expect(template).toContain(GARMOPS_BRAND.logoUrl);
    expect(template).toContain("#1D49B4");
    expect(template).toContain("#F4F6F8");
    expect(template).not.toContain("MOIST FOUNDRY");
  });

  it.each(["confirmation.html", "magic-link.html"])(
    "delivers a six-digit token instead of a sign-in link in %s",
    (templateName) => {
      const template = readTemplate(templateName);

      expect(template).toContain("{{ .Token }}");
      expect(template).not.toContain("{{ .ConfirmationURL }}");
      expect(template).not.toContain("token_hash=");
    },
  );

  it("keeps recovery and invitation actions link-based", () => {
    expect(readTemplate("recovery.html")).toContain("type=recovery");
    expect(readTemplate("invite.html")).toContain("type=invite");
  });
});
