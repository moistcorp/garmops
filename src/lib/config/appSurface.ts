export const APP_SURFACES = ["customer", "staff"] as const;

export type AppSurface = (typeof APP_SURFACES)[number];

type EnvironmentInput = Readonly<Record<string, string | undefined>>;

export function readAppSurface(
  environment: EnvironmentInput = process.env,
): AppSurface {
  return environment.NEXT_PUBLIC_APP_SURFACE === "staff" ? "staff" : "customer";
}

export function isStaffSurface(
  environment: EnvironmentInput = process.env,
): boolean {
  return readAppSurface(environment) === "staff";
}

export function customerAppUrl(
  environment: EnvironmentInput = process.env,
): string {
  return (
    environment.NEXT_PUBLIC_CUSTOMER_APP_URL ??
    (readAppSurface(environment) === "customer"
      ? environment.NEXT_PUBLIC_APP_URL
      : undefined) ??
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

export function staffAppUrl(
  environment: EnvironmentInput = process.env,
): string {
  return (
    environment.NEXT_PUBLIC_STAFF_APP_URL ??
    (readAppSurface(environment) === "staff"
      ? environment.NEXT_PUBLIC_APP_URL
      : undefined) ??
    "http://localhost:3001"
  ).replace(/\/+$/, "");
}

export function appUrlForSurface(
  surface: AppSurface,
  environment: EnvironmentInput = process.env,
): string {
  return surface === "staff"
    ? staffAppUrl(environment)
    : customerAppUrl(environment);
}
