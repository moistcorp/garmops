export const AUTH_NEXT_COOKIE = "garmops_auth_next";
export const AUTH_NEXT_COOKIE_MAX_AGE_SECONDS = 10 * 60;

export function decodeAuthNextCookie(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

export function safeInternalPath(
  value: FormDataEntryValue | string | null | undefined,
  fallback = "/account",
) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return fallback;
  }
  return value;
}

export function authCallbackUrl(next: string) {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ??
    "http://localhost:3000";
  const url = new URL("/auth/callback", appUrl);
  url.searchParams.set("next", safeInternalPath(next));
  return url.toString();
}
