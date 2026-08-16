"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import Footer from "./Footer";
import WhatsAppButton from "@/components/ui/WhatsAppButton";
import { useCartStore } from "@/lib/store";
import BackendStatusNotice from "./BackendStatusNotice";

const FOUNDRY_PORTAL_ROUTES = [
  "/orders",
  "/artwork-review",
  "/payments",
  "/discounts",
  "/staff-management",
  "/settings",
] as const;

export default function AppChrome({
  children,
  staffSurface,
}: {
  children: React.ReactNode;
  staffSurface: boolean;
}) {
  const pathname = usePathname();
  const isWithin = (route: string) =>
    pathname === route || pathname?.startsWith(`${route}/`);
  const isFoundryLogin = staffSurface && pathname === "/login";
  const isFoundryPortal =
    staffSurface && FOUNDRY_PORTAL_ROUTES.some(isWithin);
  const hasDedicatedChrome =
    isFoundryLogin ||
    isFoundryPortal ||
    isWithin("/configurator") ||
    isWithin("/account") ||
    isWithin("/staff") ||
    isWithin("/auth") ||
    [
      "/verify-email",
      "/forgot-password",
      "/reset-password",
    ].includes(pathname);
  const suppressFloatingHelp = isWithin("/cart") || isWithin("/checkout") || isWithin("/payment");

  useEffect(() => {
    const markHydrated = () => useCartStore.getState().setHasHydrated(true);
    try {
      void Promise.resolve(useCartStore.persist.rehydrate()).then(
        markHydrated,
        markHydrated,
      );
    } catch {
      markHydrated();
    }
  }, []);

  if (hasDedicatedChrome) {
    return (
      <>
        <BackendStatusNotice />
        {children}
      </>
    );
  }

  return (
    <>
      <BackendStatusNotice />
      <div className="storefront-shell techpack-canvas min-h-screen min-w-0 overflow-x-clip">
        <Navbar />
        <main className="min-w-0">{children}</main>
        <Footer />
        {!suppressFloatingHelp && <WhatsAppButton />}
      </div>
    </>
  );
}
