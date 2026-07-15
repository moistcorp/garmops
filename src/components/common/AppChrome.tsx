"use client";

import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import Footer from "./Footer";
import WhatsAppButton from "@/components/ui/WhatsAppButton";

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isConfigurator = pathname.startsWith("/configurator");

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
