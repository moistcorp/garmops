"use client";
import { useActionState } from "react";
import { setStaffActiveAction } from "@/app/staff/actions";
import { INITIAL_STAFF_ACTION_STATE } from "@/lib/staff/actionState";
export default function StaffManagementForms({ userId, active }: { userId: string; active: boolean }) {
  const [state, action, pending] = useActionState(setStaffActiveAction, INITIAL_STAFF_ACTION_STATE);
  return <form action={action}><input type="hidden" name="userId" value={userId} /><input type="hidden" name="active" value={active ? "false" : "true"} /><button disabled={pending} className="rounded border border-black/10 px-3 py-2 text-xs font-semibold" type="submit">{pending ? "Saving…" : active ? "Disable" : "Restore"}</button>{state.status === "error" ? <p className="mt-1 text-xs text-red-700">{state.message}</p> : null}</form>;
}
