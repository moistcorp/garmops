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

function findLastBytes(haystack: Uint8Array, needle: Uint8Array, from = 0): number {
  let found = -1;
  let next = from;
  while (next <= haystack.length - needle.length) {
    const match = findBytes(haystack, needle, next);
    if (match < 0) break;
    found = match;
    next = match + 1;
  }
  return found;
}

export function extractPdfCompatiblePayload(bytes: Uint8Array): Uint8Array | null {
  const header = new TextEncoder().encode('%PDF-');
  const eof = new TextEncoder().encode('%%EOF');
  let start = findBytes(bytes, header);
  while (start >= 0) {
    const end = findLastBytes(bytes, eof, start);
    if (end >= 0) return bytes.slice(start, end + eof.length);
    start = findBytes(bytes, header, start + header.length);
  }
  return null;
}

const PNG_HEADER = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const PNG_END = new Uint8Array([73, 69, 78, 68, 174, 66, 96, 130]);
const JPEG_START = new Uint8Array([255, 216, 255]);
const JPEG_END = new Uint8Array([255, 217]);

function embeddedImageBytes(bytes: Uint8Array): Array<{ bytes: Uint8Array; type: 'image/png' | 'image/jpeg' }> {
  const images: Array<{ bytes: Uint8Array; type: 'image/png' | 'image/jpeg' }> = [];
  let pngStart = findBytes(bytes, PNG_HEADER);
  while (pngStart >= 0 && images.length < 4) {
    const end = findBytes(bytes, PNG_END, pngStart + PNG_HEADER.length);
    if (end < 0) break;
    images.push({ bytes: bytes.slice(pngStart, end + PNG_END.length), type: 'image/png' });
    pngStart = findBytes(bytes, PNG_HEADER, end + PNG_END.length);
  }
  let jpegStart = findBytes(bytes, JPEG_START);
  while (jpegStart >= 0 && images.length < 4) {
    const end = findBytes(bytes, JPEG_END, jpegStart + JPEG_START.length);
    if (end < 0) break;
    images.push({ bytes: bytes.slice(jpegStart, end + JPEG_END.length), type: 'image/jpeg' });
    jpegStart = findBytes(bytes, JPEG_START, end + JPEG_END.length);
  }
  return images;
}

function renderImageBytes(bytes: Uint8Array, type: 'image/png' | 'image/jpeg'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const ownedBytes = new Uint8Array(bytes.byteLength);
    ownedBytes.set(bytes);
    const sourceUrl = URL.createObjectURL(new Blob([ownedBytes.buffer], { type }));
    const image = new Image();
    image.onload = async () => {
      try {
        if (!image.naturalWidth || !image.naturalHeight) throw new AiPreviewError('corrupt');
        const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = window.document.createElement('canvas');
        canvas.width = Math.max(1, Math.ceil(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.ceil(image.naturalHeight * scale));
        const context = canvas.getContext('2d', { alpha: true });
        if (!context) throw new AiPreviewError('corrupt');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>((resolveBlob) => canvas.toBlob(resolveBlob, 'image/png'));
        if (!blob) throw new AiPreviewError('corrupt');
        resolve(blob);
      } catch (error) {
        reject(error instanceof AiPreviewError ? error : new AiPreviewError('corrupt'));
      } finally {
        URL.revokeObjectURL(sourceUrl);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(sourceUrl);
      reject(new AiPreviewError('corrupt'));
    };
    image.src = sourceUrl;
  });
}

function hexPreview(bytes: Uint8Array): { width: number; height: number; pixels: Uint8Array } | null {
  const text = new TextDecoder('windows-1252').decode(bytes);
  const match = text.match(/%%BeginPreview:\s*(\d+)\s+(\d+)\s+(1|8)\s+\d+\s*\r?\n([\s\S]*?)%%EndPreview/iu);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  const depth = Number(match[3]);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || width * height > 4_000_000) return null;
  const hex = match[4].replace(/[^0-9a-f]/giu, '');
  const expectedBytes = depth === 1 ? Math.ceil(width / 8) * height : width * height;
  if (hex.length < expectedBytes * 2) return null;
  const pixels = new Uint8Array(width * height);
  if (depth === 8) {
    for (let index = 0; index < pixels.length; index += 1) pixels[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  } else {
    const rowBytes = Math.ceil(width / 8);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const byte = Number.parseInt(hex.slice((y * rowBytes + Math.floor(x / 8)) * 2, (y * rowBytes + Math.floor(x / 8)) * 2 + 2), 16);
        pixels[y * width + x] = byte & (1 << (7 - (x % 8))) ? 0 : 255;
      }
    }
  }
  return { width, height, pixels };
}

async function renderEpsPreview(bytes: Uint8Array): Promise<Blob | null> {
  const preview = hexPreview(bytes);
  if (!preview) return null;
  const canvas = window.document.createElement('canvas');
  canvas.width = preview.width;
  canvas.height = preview.height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return null;
  const image = context.createImageData(preview.width, preview.height);
  for (let index = 0; index < preview.pixels.length; index += 1) {
    const offset = index * 4;
    const value = preview.pixels[index];
    image.data[offset] = value;
    image.data[offset + 1] = value;
    image.data[offset + 2] = value;
    image.data[offset + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

function renderPdfPage(pdfBytes: Uint8Array): Promise<Blob> {
  return import('pdfjs-dist/legacy/build/pdf.mjs').then(async (pdfjs) => {
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/legacy/build/pdf.worker.mjs',
        import.meta.url,
      ).toString();
    }
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
    if (process.env.NODE_ENV !== 'production') console.error('Artwork PDF preview render failed', error);
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
  const payload = extractPdfCompatiblePayload(bytes);
  if (payload) {
    const candidates = payload.byteLength === bytes.byteLength ? [payload] : [bytes, payload];
    let lastError: unknown;
    for (const candidate of candidates) {
      try {
        return await renderPdfPage(candidate);
      } catch (error) {
        lastError = error;
      }
    }
    if (lastError && !(lastError instanceof AiPreviewError)) throw new AiPreviewError('corrupt');
  }

  // Some Illustrator/EPS files do not contain a PDF-compatible payload but do
  // contain a safe embedded raster preview. Decode only image signatures; do
  // not execute PostScript or hand the source file to a shell converter.
  for (const embedded of embeddedImageBytes(bytes)) {
    try {
      return await renderImageBytes(embedded.bytes, embedded.type);
    } catch {
      // Try the next embedded preview, if present.
    }
  }
  const epsPreview = await renderEpsPreview(bytes);
  if (epsPreview) return epsPreview;

  throw new AiPreviewError('incompatible');
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
