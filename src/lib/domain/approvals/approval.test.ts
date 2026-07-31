import { describe, expect, it } from "vitest";

import { createApprovalToken, hashApprovalToken } from "./approval";

describe("external approval tokens", () => {
  it("creates high-entropy bearer tokens and stores only a deterministic hash", () => {
    const first = createApprovalToken();
    const second = createApprovalToken();

    expect(first.token).not.toBe(second.token);
    expect(first.token.length).toBeGreaterThanOrEqual(40);
    expect(first.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(first.hash).toBe(hashApprovalToken(first.token));
    expect(first.hash).not.toContain(first.token);
  });

  it("changes the hash when any token character changes", () => {
    const { token, hash } = createApprovalToken();
    const changed = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;
    expect(hashApprovalToken(changed)).not.toBe(hash);
  });
});
