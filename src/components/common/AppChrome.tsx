"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import Footer from "./Footer";
import WhatsAppButton from "@/components/ui/WhatsAppButton";
import { useCartStore } from "@/lib/store";

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isConfigurator = pathname.startsWith("/configurator");

  useEffect(() => {
    void useCartStore.persist.rehydrate();
  }, []);

  if (isConfigurator) {
    return <>{children}</>;
  }

  return (
    <div className="app-liquid-bg min-h-screen min-w-0 overflow-x-clip">
      <Navbar />
      <main className="min-w-0">{children}</main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}
