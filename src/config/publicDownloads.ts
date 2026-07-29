function configuredDownloadsOrigin(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash &&
      !url.username &&
      !url.password
      ? url.origin
      : undefined;
  } catch {
    return undefined;
  }
}

const configuredBase = configuredDownloadsOrigin(
  process.env.NEXT_PUBLIC_DOWNLOADS_BASE_URL,
);

export const publicDownloads = Object.freeze({
  printTemplates:
    configuredBase !== undefined
      ? `${configuredBase}/templates/print/Garmops-print_templates-1.0.zip`
      : "/downloads/Garmops-print_templates-1.0.zip",
  neckLabelTemplates:
    configuredBase !== undefined
      ? `${configuredBase}/templates/neck-label/neck-label-templates-1.0.zip`
      : "/downloads/neck-label-templates.zip",
});
