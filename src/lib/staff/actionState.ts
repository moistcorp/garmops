export type StaffActionState = {
  status: "idle" | "success" | "error";
  message: string;
  resetToken: number;
};

export const INITIAL_STAFF_ACTION_STATE: StaffActionState = {
  status: "idle",
  message: "",
  resetToken: 0,
};

export function staffActionSuccess(message: string): StaffActionState {
  return { status: "success", message, resetToken: Date.now() };
}

export function staffActionError(message: string): StaffActionState {
  return { status: "error", message, resetToken: Date.now() };
}
