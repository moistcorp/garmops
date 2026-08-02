"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import Footer from "./Footer";
import WhatsAppButton from "@/components/ui/WhatsAppButton";
import { useCartStore } from "@/lib/store";

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isWithin = (route: string) =>
    pathname === route || pathname.startsWith(`${route}/`);
  const hasDedicatedChrome =
    isWithin("/configurator") ||
    isWithin("/account") ||
    isWithin("/staff") ||
    isWithin("/auth") ||
    [
      "/verify-email",
      "/forgot-password",
      "/reset-password",
    ].includes(pathname);

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
    return <>{children}</>;
  }

  return (
    <div className="techpack-canvas min-h-screen min-w-0 overflow-x-clip">
      <Navbar />
      <main className="min-w-0">{children}</main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}
