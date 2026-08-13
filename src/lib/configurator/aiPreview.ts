export class AiPreviewError extends Error {
  readonly code: 'incompatible' | 'corrupt';

  constructor(code: 'incompatible' | 'corrupt') {
    super(code === 'incompatible' ? 'AI file has no PDF-compatible preview data' : 'AI file could not be read');
    this.name = 'AiPreviewError';
    this.code = code;
  }
}

function findBytes(haystack: Uint8Array, needle: Uint8Array, from = 0): number {
  outer: for (let index = from; index <= haystack.length - needle.length; index += 1) {
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (haystack[index + offset] !== needle[offset]) continue outer;
    }
    return index;
  }
  return -1;
}

function pdfCompatiblePayload(bytes: Uint8Array): Uint8Array | null {
  const header = new TextEncoder().encode('%PDF-');
  const eof = new TextEncoder().encode('%%EOF');
  const start = findBytes(bytes, header);
  if (start < 0) return null;
  const end = findBytes(bytes, eof, start);
  if (end < 0) return null;
  return bytes.slice(start, end + eof.length);
}

function renderPdfPage(pdfBytes: Uint8Array): Promise<Blob> {
  return import('pdfjs-dist/legacy/build/pdf.mjs').then(async (pdfjs) => {
    const documentOptions = {
      data: pdfBytes,
      disableAutoFetch: true,
      disableStream: true,
      useSystemFonts: false,
      // PDF.js 5 omits this legacy option from its declarations, but still
      // honours it at runtime. Static artwork previews do not need scripting.
      isEvalSupported: false,
    } as Parameters<typeof pdfjs.getDocument>[0] & { isEvalSupported: boolean };
    const loadingTask = pdfjs.getDocument(documentOptions);

    try {
      const document = await loadingTask.promise;
      if (document.numPages < 1) throw new AiPreviewError('corrupt');
      const page = await document.getPage(1);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(2, 1200 / Math.max(baseViewport.width, baseViewport.height));
      const viewport = page.getViewport({ scale: Math.max(scale, 0.5) });
      const canvas = window.document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d', { alpha: true });
      if (!context) throw new AiPreviewError('corrupt');
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new AiPreviewError('corrupt');
      return blob;
    } finally {
      await loadingTask.destroy();
    }
  }).catch((error: unknown) => {
    if (error instanceof AiPreviewError) throw error;
    throw new AiPreviewError('corrupt');
  });
}

/**
 * Illustrator files with “Create PDF Compatible File” contain a PDF payload.
 * Only that payload is handed to PDF.js; the original AI file is never changed
 * or placed in the DOM. The returned PNG is a UI-only derivative.
 */
export async function renderAiPreview(file: Blob): Promise<string> {
  return URL.createObjectURL(await renderAiPreviewBlob(file));
}

export async function renderAiPreviewBlob(file: Blob): Promise<Blob> {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    throw new AiPreviewError('corrupt');
  }
  const payload = pdfCompatiblePayload(bytes);
  if (!payload) throw new AiPreviewError('incompatible');
  const candidates = payload.byteLength === bytes.byteLength ? [payload] : [bytes, payload];
  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      return await renderPdfPage(candidate);
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError instanceof AiPreviewError) throw lastError;
  throw new AiPreviewError('corrupt');
}

/** Renders page 1 of a customer PDF without executing PDF scripting. */
export async function renderPdfPreview(file: Blob): Promise<Blob> {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    throw new AiPreviewError('corrupt');
  }
  if (bytes.length < 5 || new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') {
    throw new AiPreviewError('corrupt');
  }
  try {
    return await renderPdfPage(bytes);
  } catch (error) {
    if (error instanceof AiPreviewError) throw error;
    throw new AiPreviewError('corrupt');
  }
}
