import "server-only";

export class RequestBodyError extends Error {
  constructor(
    readonly code: "invalid" | "too_large" | "unsupported_media_type",
  ) {
    super(code);
    this.name = "RequestBodyError";
  }
}

type BodyMessage = Pick<Request, "headers" | "body">;

function contentType(request: BodyMessage): string {
  return request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function assertDeclaredLength(request: BodyMessage, maximumBytes: number): void {
  const declared = request.headers.get("content-length");
  if (declared === null) return;

  const length = Number(declared);
  if (!Number.isSafeInteger(length) || length < 0) {
    throw new RequestBodyError("invalid");
  }
  if (length > maximumBytes) throw new RequestBodyError("too_large");
}

export async function readBoundedBody(
  request: BodyMessage,
  maximumBytes: number,
): Promise<Buffer> {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 0) {
    throw new TypeError("maximumBytes must be a non-negative safe integer");
  }
  assertDeclaredLength(request, maximumBytes);

  if (!request.body) return Buffer.alloc(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel("request body limit exceeded");
        throw new RequestBodyError("too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, total);
}

export async function readBoundedJson(
  request: BodyMessage,
  maximumBytes: number,
): Promise<unknown> {
  const mediaType = contentType(request);
  if (mediaType !== "application/json" && !mediaType.endsWith("+json")) {
    throw new RequestBodyError("unsupported_media_type");
  }

  try {
    return JSON.parse(
      (await readBoundedBody(request, maximumBytes)).toString("utf8"),
    ) as unknown;
  } catch (error) {
    if (error instanceof RequestBodyError) throw error;
    throw new RequestBodyError("invalid");
  }
}

export async function readBoundedUrlEncoded(
  request: BodyMessage,
  maximumBytes: number,
): Promise<URLSearchParams> {
  if (contentType(request) !== "application/x-www-form-urlencoded") {
    throw new RequestBodyError("unsupported_media_type");
  }
  return new URLSearchParams(
    (await readBoundedBody(request, maximumBytes)).toString("utf8"),
  );
}
