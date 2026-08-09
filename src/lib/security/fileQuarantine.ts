export function isPrivateFileDownloadAllowed(scanStatus: string, scanningEnabled: boolean): boolean {
  if (!scanningEnabled) return scanStatus !== "rejected" && scanStatus !== "infected";
  return scanStatus === "clean" || scanStatus === "not_required";
}

export function isMalwareScanTerminal(scanStatus: string): boolean {
  return scanStatus === "clean" || scanStatus === "infected";
}
