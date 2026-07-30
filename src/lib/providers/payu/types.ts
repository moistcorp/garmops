export type PayuIncomingFields = {
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
  mihpayid?: string;
  unmappedstatus?: string;
  error?: string;
  error_Message?: string;
  additional_charges?: string;
  additionalCharges?: string;
  splitInfo?: string;
};

export type PayuCheckoutFields = {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  phone?: string;
  surl: string;
  furl: string;
  udf1: string;
  udf2: string;
  udf3: string;
  udf4: string;
  udf5: string;
  hash: string;
};

export type PayuVerificationStatus = "success" | "pending" | "failed" | "unknown";

export type PayuVerificationResult = {
  status: PayuVerificationStatus;
  merchantTransactionId: string;
  providerPaymentId: string | null;
  amountPaise: number | null;
  currency: "INR";
  providerStatus: string;
  unmappedStatus: string;
  failureCode: string | null;
  failureMessage: string | null;
  snapshot: Record<string, unknown>;
};
