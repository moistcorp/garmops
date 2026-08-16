export const TERMS_VERSION = "2026-07-29";
export const PRIVACY_VERSION = "2026-07-29";

export const STAFF_ROLES = ["founder", "operations"] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export type AuthActionState = {
  status: "idle" | "error" | "success";
  message: string;
  fieldErrors?: Record<string, string[]>;
  verificationEmail?: string;
  challengeId?: string;
  testCode?: string;
  destination?: string;
  requiresOnboarding?: boolean;
  resetToken: number;
  mfaChallengeId?: string;
  mfaMethods?: string[];
  mfaFactorId?: string;
  mfaSecret?: string;
  mfaOtpAuthUrl?: string;
};

export const INITIAL_AUTH_ACTION_STATE: AuthActionState = {
  status: "idle",
  message: "",
  resetToken: 0,
};

export function actionError(
  message: string,
  fieldErrors?: Record<string, string[]>,
): AuthActionState {
  return {
    status: "error",
    message,
    fieldErrors,
    resetToken: Date.now(),
  };
}

export function actionSuccess(
  message: string,
  options?: {
    verificationEmail?: string;
    challengeId?: string;
    testCode?: string;
    destination?: string;
    requiresOnboarding?: boolean;
    mfaChallengeId?: string;
    mfaMethods?: string[];
    mfaFactorId?: string;
    mfaSecret?: string;
    mfaOtpAuthUrl?: string;
  },
): AuthActionState {
  return {
    status: "success",
    message,
    verificationEmail: options?.verificationEmail,
    challengeId: options?.challengeId,
    testCode: options?.testCode,
    destination: options?.destination,
    requiresOnboarding: options?.requiresOnboarding,
    mfaChallengeId: options?.mfaChallengeId,
    mfaMethods: options?.mfaMethods,
    mfaFactorId: options?.mfaFactorId,
    mfaSecret: options?.mfaSecret,
    mfaOtpAuthUrl: options?.mfaOtpAuthUrl,
    resetToken: Date.now(),
  };
}
