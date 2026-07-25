import crypto from "crypto";

export const PAYMENT_RESULT_COOKIE = "mf_payment_result";

export type PaymentKind = "configurator" | "sample-cart";

export type PaymentTokenPayload = {
  version: 1;
  txnid: string;
  amount: string;
  kind: PaymentKind;
  issuedAt: number;
};

export type PaymentResultPayload = PaymentTokenPayload & {
  status: "success" | "failure";
  mock: boolean;
};

const TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function getSigningSecret(): string | null {
  const configuredSecret = process.env.PAYMENT_SIGNING_SECRET ?? process.env.PAYU_SALT;
  if (configuredSecret) return configuredSecret;

  // Local mock checkout still needs a signed hand-off. This value is never
  // used in production, where a configured secret is mandatory.
  return process.env.NODE_ENV === "development"
    ? "garmops-development-only-payment-secret"
    : null;
}

function sign(value: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function encodeSignedPayload(payload: object): string | null {
  const secret = getSigningSecret();
  if (!secret) return null;

  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded, secret)}`;
}

function decodeSignedPayload<T>(token: string): T | null {
  const secret = getSigningSecret();
  if (!secret) return null;

  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;

  const encoded = token.slice(0, separator);
  const suppliedSignature = token.slice(separator + 1);
  const expectedSignature = sign(encoded, secret);
  const suppliedBuffer = Buffer.from(suppliedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    suppliedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

function isCurrentToken(payload: { issuedAt?: unknown }): payload is { issuedAt: number } {
  return (
    typeof payload.issuedAt === "number" &&
    payload.issuedAt <= Date.now() + 60_000 &&
    Date.now() - payload.issuedAt <= TOKEN_MAX_AGE_MS
  );
}

function isPaymentKind(value: unknown): value is PaymentKind {
  return value === "configurator" || value === "sample-cart";
}

export function createPaymentToken(
  txnid: string,
  amount: string,
  kind: PaymentKind
): string | null {
  return encodeSignedPayload({
    version: 1,
    txnid,
    amount,
    kind,
    issuedAt: Date.now(),
  } satisfies PaymentTokenPayload);
}

export function decodePaymentToken(token: string): PaymentTokenPayload | null {
  const payload = decodeSignedPayload<Partial<PaymentTokenPayload>>(token);
  if (
    !payload ||
    payload.version !== 1 ||
    typeof payload.txnid !== "string" ||
    typeof payload.amount !== "string" ||
    !isPaymentKind(payload.kind) ||
    !isCurrentToken(payload)
  ) {
    return null;
  }

  return payload as PaymentTokenPayload;
}

export function createPaymentResultCookie(
  payment: PaymentTokenPayload,
  status: PaymentResultPayload["status"],
  mock = false
): string | null {
  return encodeSignedPayload({ ...payment, status, mock } satisfies PaymentResultPayload);
}

export function decodePaymentResultCookie(value?: string): PaymentResultPayload | null {
  if (!value) return null;

  const payload = decodeSignedPayload<Partial<PaymentResultPayload>>(value);
  if (
    !payload ||
    payload.version !== 1 ||
    typeof payload.txnid !== "string" ||
    typeof payload.amount !== "string" ||
    !isPaymentKind(payload.kind) ||
    (payload.status !== "success" && payload.status !== "failure") ||
    typeof payload.mock !== "boolean" ||
    !isCurrentToken(payload)
  ) {
    return null;
  }

  return payload as PaymentResultPayload;
}

export type PayuResponseFields = {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  udf1: string;
  udf2: string;
  udf3: string;
  udf4: string;
  udf5: string;
  status: string;
  hash: string;
  additionalCharges?: string;
  additional_charges?: string;
};

export function verifyPayuResponse(fields: PayuResponseFields): boolean {
  const merchantKey = process.env.PAYU_MERCHANT_KEY;
  const salt = process.env.PAYU_SALT;
  if (!merchantKey || !salt || fields.key !== merchantKey) return false;

  const additionalCharges = fields.additional_charges ?? fields.additionalCharges;
  const reverseHashParts = [
    salt,
    fields.status,
    "",
    "",
    "",
    "",
    "",
    fields.udf5,
    fields.udf4,
    fields.udf3,
    fields.udf2,
    fields.udf1,
    fields.email,
    fields.firstname,
    fields.productinfo,
    fields.amount,
    fields.txnid,
    fields.key,
  ];
  if (additionalCharges) reverseHashParts.unshift(additionalCharges);

  const expectedHash = crypto
    .createHash("sha512")
    .update(reverseHashParts.join("|"))
    .digest("hex");
  const suppliedHash = fields.hash.toLowerCase();

  if (!/^[a-f0-9]{128}$/.test(suppliedHash)) return false;
  return crypto.timingSafeEqual(
    Buffer.from(suppliedHash, "hex"),
    Buffer.from(expectedHash, "hex")
  );
}
