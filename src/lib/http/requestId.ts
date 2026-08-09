const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export function requestIdFrom(request?: Pick<Request, "headers">): string {
  const supplied = request?.headers.get("x-request-id")?.trim();
  return supplied && REQUEST_ID_PATTERN.test(supplied)
    ? supplied
    : crypto.randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase();
}

export function withRequestId<T extends Response>(response: T, requestId: string): T {
  response.headers.set("X-Request-ID", requestId);
  return response;
}
