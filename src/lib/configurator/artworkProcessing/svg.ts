import { ArtworkProcessingError } from "./types";

const SVG_NS = "http://www.w3.org/2000/svg";
const ALLOWED_ELEMENTS = new Set([
  "svg", "g", "path", "rect", "circle", "ellipse", "polygon", "polyline", "line",
  "defs", "clipPath", "mask", "linearGradient", "radialGradient", "stop", "title",
]);
const ALLOWED_ATTRIBUTES = new Set([
  "viewBox", "width", "height", "x", "y", "x1", "x2", "y1", "y2", "cx", "cy", "r", "rx", "ry",
  "d", "points", "fill", "fill-opacity", "fill-rule", "clip-rule", "stroke", "stroke-width",
  "stroke-opacity", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "opacity", "transform",
  "preserveAspectRatio", "offset", "stop-color", "stop-opacity", "clip-path", "mask", "id", "class",
]);
const FORBIDDEN_ELEMENTS = new Set(["script", "foreignObject", "iframe", "object", "embed", "audio", "video", "image", "style", "link"]);

function numericDimension(value: string | null): number | undefined {
  if (!value) return undefined;
  const match = value.trim().match(/^([0-9]+(?:\.[0-9]+)?)/);
  const number = match ? Number(match[1]) : NaN;
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function hasUnsafeValue(value: string): boolean {
  return /javascript\s*:|data\s*:\s*text\/html|url\s*\(\s*https?:|https?:\/\//iu.test(value);
}

function copySafeNode(source: Element, targetDocument: XMLDocument, removed: { count: number }): Element | null {
  const name = source.localName;
  if (!name || FORBIDDEN_ELEMENTS.has(name)) {
    removed.count += 1;
    return null;
  }
  if (!ALLOWED_ELEMENTS.has(name)) {
    removed.count += 1;
    return null;
  }

  const target = targetDocument.createElementNS(SVG_NS, name);
  for (const attribute of Array.from(source.attributes)) {
    const attributeName = attribute.name;
    const attributeValue = attribute.value;
    if (
      attributeName.toLowerCase().startsWith("on") ||
      !ALLOWED_ATTRIBUTES.has(attributeName) ||
      hasUnsafeValue(attributeValue)
    ) {
      removed.count += 1;
      continue;
    }
    target.setAttribute(attributeName, attributeValue);
  }
  for (const child of Array.from(source.children)) {
    const safeChild = copySafeNode(child, targetDocument, removed);
    if (safeChild) target.appendChild(safeChild);
  }
  return target;
}

function viewBoxFor(root: Element): string {
  const existing = root.getAttribute("viewBox")?.trim();
  if (existing && /^\s*-?[0-9.]+(?:\s+|,)\s*-?[0-9.]+(?:\s+|,)\s*[0-9.]+(?:\s+|,)\s*[0-9.]+\s*$/u.test(existing)) {
    return existing.replaceAll(",", " ").split(/\s+/u).join(" ");
  }
  const width = numericDimension(root.getAttribute("width")) ?? 100;
  const height = numericDimension(root.getAttribute("height")) ?? 100;
  return `0 0 ${width} ${height}`;
}

export function sanitizeAndNormalizeSvg(source: string): { text: string; warnings: string[] } {
  if (source.length > 5 * 1024 * 1024) {
    throw new ArtworkProcessingError("processing_limit", "SVG is too large");
  }
  if (typeof DOMParser === "undefined" || typeof XMLSerializer === "undefined") {
    throw new ArtworkProcessingError("unsafe_svg", "SVG parsing is unavailable");
  }
  const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
  if (parsed.querySelector("parsererror")) {
    throw new ArtworkProcessingError("unsafe_svg", "SVG could not be parsed");
  }
  const sourceRoot = parsed.documentElement;
  if (sourceRoot.localName !== "svg") {
    throw new ArtworkProcessingError("unsafe_svg", "SVG root is missing");
  }

  const output = parsed.implementation.createDocument(null, "svg", null);
  const root = output.documentElement;
  const removed = { count: 0 };
  for (const attribute of Array.from(sourceRoot.attributes)) {
    if (attribute.name === "xmlns" || attribute.name === "xmlns:xlink") continue;
    if (ALLOWED_ATTRIBUTES.has(attribute.name) && !hasUnsafeValue(attribute.value)) {
      root.setAttribute(attribute.name, attribute.value);
    }
  }
  root.setAttribute("xmlns", SVG_NS);
  root.setAttribute("viewBox", viewBoxFor(sourceRoot));
  root.setAttribute("preserveAspectRatio", "xMidYMid meet");
  for (const child of Array.from(sourceRoot.children)) {
    const safeChild = copySafeNode(child, output, removed);
    if (safeChild) root.appendChild(safeChild);
  }

  const text = new XMLSerializer().serializeToString(output);
  if (text.length > 8 * 1024 * 1024) {
    throw new ArtworkProcessingError("processing_limit", "Normalized SVG is too large");
  }
  return {
    text,
    warnings: removed.count > 0 ? ["Some unsupported SVG content was removed before preview."] : [],
  };
}

export function svgBlob(text: string): Blob {
  return new Blob([text], { type: "image/svg+xml" });
}
