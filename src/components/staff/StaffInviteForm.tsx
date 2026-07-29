"use client";

import { useActionState } from "react";
import { inviteStaffAction } from "@/app/staff/actions";
import {
  INITIAL_AUTH_ACTION_STATE,
  STAFF_ROLES,
} from "@/lib/auth/constants";

const control = "liquid-glass-control rounded-xl border px-4 py-3 text-sm outline-none focus:!border-[var(--color-teal)]";

export default function StaffInviteForm() {
  const [state, action, pending] = useActionState(
    inviteStaffAction,
    INITIAL_AUTH_ACTION_STATE,
  );
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input className={control} name="firstName" placeholder="First name" required />
      <input className={control} name="lastName" placeholder="Last name" required />
      <input className={control} name="email" type="email" placeholder="Work email" required />
      <select className={control} name="role" defaultValue="read_only">
        {STAFF_ROLES.map((role) => <option key={role} value={role}>{role.replaceAll("_", " ")}</option>)}
      </select>
      <input className={`${control} sm:col-span-2`} name="team" placeholder="Team (optional)" />
      {state.message ? (
        <p role={state.status === "error" ? "alert" : "status"} className={`sm:col-span-2 text-sm ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`}>
          {state.message}
        </p>
      ) : null}
      <button disabled={pending} className="rounded-full bg-[var(--color-teal)] px-5 py-3 text-sm font-medium text-white disabled:opacity-60 sm:col-span-2">
        {pending ? "Sending…" : "Send secure invitation"}
      </button>
    </form>
  );
}
