export function attachmentContentDisposition(filename: string): string {
  const normalized = filename.normalize("NFKC");
  const fallback =
    normalized
      .replace(/[^\x20-\x7e]/g, "_")
      .replace(/["\\;]/g, "_")
      .replace(/[\r\n]/g, "_")
      .trim()
      .slice(0, 180) || "download";
  const encodedName = Array.from(normalized).slice(0, 180).join("");
  const encoded = encodeURIComponent(encodedName)
    .replace(/['()*]/g, (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    );

  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
