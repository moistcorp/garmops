export const TERMS_VERSION = "2026-07-29";
export const PRIVACY_VERSION = "2026-07-29";

export const STAFF_ROLES = [
  "super_admin",
  "operations_admin",
  "sales",
  "production",
  "artwork",
  "finance",
  "qc",
  "dispatch",
  "support",
  "read_only",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export type AuthActionState = {
  status: "idle" | "error" | "success";
  message: string;
  fieldErrors?: Record<string, string[]>;
  resetToken: number;
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

export function actionSuccess(message: string): AuthActionState {
  return {
    status: "success",
    message,
    resetToken: Date.now(),
  };
}
