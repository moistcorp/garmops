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
    <>
      <Navbar />
      <main>{children}</main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
