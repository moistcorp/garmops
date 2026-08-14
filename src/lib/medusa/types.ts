export type MedusaErrorBody = {
  code?: string;
  message?: string;
  requestId?: string;
  problems?: string[];
  [key: string]: unknown;
};

export type MedusaRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  actor?: "customer" | "staff" | "public";
  token?: string;
};

export type MedusaResponse<T> = {
  data: T;
  requestId: string | null;
};

export class MedusaApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly requestId: string | null;
  readonly body: MedusaErrorBody;

  constructor(status: number, body: MedusaErrorBody, requestId?: string | null) {
    super(body.message || "The request could not be completed.");
    this.name = "MedusaApiError";
    this.status = status;
    this.code = typeof body.code === "string" ? body.code : null;
    this.requestId = requestId ?? (typeof body.requestId === "string" ? body.requestId : null);
    this.body = body;
  }
}
