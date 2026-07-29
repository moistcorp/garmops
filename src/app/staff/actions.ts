"use server";

import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import { z } from "zod";
import {
  STAFF_ROLES,
  actionError,
  actionSuccess,
  type AuthActionState,
} from "@/lib/auth/constants";
import { authCallbackUrl } from "@/lib/auth/redirects";
import { consumeAuthRateLimit } from "@/lib/auth/rateLimit";
import { requireStaffPermission } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getServerEnvironment } from "@/lib/config/env";

const inviteSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
  role: z.enum(STAFF_ROLES),
  team: z.string().trim().max(80),
});

export async function inviteStaffAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const context = await requireStaffPermission("manage_staff");
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return actionError(
      "Check the invitation details.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const rate = await consumeAuthRateLimit("staff_invite", parsed.data.email);
    if (!rate.allowed) return actionError("Invitation limit reached. Try again later.");
  } catch {
    return actionError("Staff invitations are temporarily unavailable.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "invite",
    email: parsed.data.email,
    options: {
      redirectTo: authCallbackUrl("/reset-password?invite=1"),
      data: {
        first_name: parsed.data.firstName,
        last_name: parsed.data.lastName,
      },
    },
  });
  if (error || !data.user) {
    return actionError("We could not create that staff invitation.");
  }

  const { error: provisionError } = await context.supabase.rpc(
    "provision_staff_invitation",
    {
      p_user_id: data.user.id,
      p_first_name: parsed.data.firstName,
      p_last_name: parsed.data.lastName,
      p_role: parsed.data.role,
      p_team: parsed.data.team,
    },
  );
  if (provisionError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return actionError("We could not provision that staff member.");
  }

  const environment = getServerEnvironment();
  if (!environment.RESEND_API_KEY || !environment.RESEND_FROM_EMAIL) {
    await admin.auth.admin.deleteUser(data.user.id);
    return actionError("Staff invitation email is not configured.");
  }
  const acceptUrl = new URL("/auth/callback", environment.NEXT_PUBLIC_APP_URL);
  acceptUrl.searchParams.set("token_hash", data.properties.hashed_token);
  acceptUrl.searchParams.set("type", "invite");
  acceptUrl.searchParams.set("next", "/reset-password?invite=1");
  const safeFirstName = parsed.data.firstName
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
  const safeAcceptUrl = acceptUrl.toString().replaceAll("&", "&amp;");
  const resend = new Resend(environment.RESEND_API_KEY);
  const { error: deliveryError } = await resend.emails.send({
    from: environment.RESEND_FROM_EMAIL,
    to: parsed.data.email,
    subject: "Your Garmops staff invitation",
    html: `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #111111;">
        <h1 style="font-size: 20px;">You have been invited to Garmops staff operations</h1>
        <p>Hi ${safeFirstName},</p>
        <p>Set your password using the secure, time-limited link below. Your staff access remains inactive until you enroll and verify an authenticator app.</p>
        <p style="margin: 28px 0;">
          <a href="${safeAcceptUrl}" style="background: #087f7b; color: white; padding: 12px 20px; border-radius: 999px; text-decoration: none;">Accept staff invitation</a>
        </p>
        <p style="font-size: 12px; color: #666666;">If you were not expecting this invitation, do not use or forward this link. Garmops will never ask for your password or authenticator code.</p>
      </div>
    `,
  });
  if (deliveryError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return actionError("We could not deliver that staff invitation.");
  }

  revalidatePath("/staff/settings/team");
  return actionSuccess("Invitation sent. Access remains inactive until TOTP MFA is verified.");
}

export async function deactivateStaffAction(formData: FormData) {
  const context = await requireStaffPermission("manage_staff");
  const userId = z.string().uuid().safeParse(formData.get("userId"));
  if (!userId.success) return;
  await context.supabase.rpc("deactivate_staff_member", {
    p_user_id: userId.data,
  });
  revalidatePath("/staff/settings/team");
}

export async function completeStaffMfaAction() {
  const supabase = await createClient();
  const [{ data: userData }, { data: assurance }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (!userData.user || assurance?.currentLevel !== "aal2") {
    return { ok: false };
  }

  const { error: activationError } = await supabase.rpc("activate_invited_staff");
  if (activationError) {
    const { data: staff } = await supabase
      .from("staff_members")
      .select("active, deactivated_at")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!staff?.active || staff.deactivated_at) return { ok: false };
  }
  const { error } = await supabase.rpc("record_staff_login");
  return { ok: !error };
}
