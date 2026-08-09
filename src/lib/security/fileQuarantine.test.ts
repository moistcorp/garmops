import { describe, expect, it } from "vitest";
import { isMalwareScanTerminal, isPrivateFileDownloadAllowed } from "./fileQuarantine";

describe("private file quarantine", () => {
  it("allows clean files and denies infected files when scanning is enabled", () => {
    expect(isPrivateFileDownloadAllowed("clean", true)).toBe(true);
    expect(isPrivateFileDownloadAllowed("infected", true)).toBe(false);
  });

  it.each(["pending_scan", "scan_failed", "scanner_unavailable", "rejected"])("fails closed for %s", (status) => {
    expect(isPrivateFileDownloadAllowed(status, true)).toBe(false);
  });

  it("treats clean and infected results as idempotent terminal states", () => {
    expect(isMalwareScanTerminal("clean")).toBe(true);
    expect(isMalwareScanTerminal("infected")).toBe(true);
    expect(isMalwareScanTerminal("scan_failed")).toBe(false);
  });
});
