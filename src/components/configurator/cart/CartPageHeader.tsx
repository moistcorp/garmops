import Link from "next/link";
import Image from "next/image";
import { NetworkStatusBanner } from "../NetworkStatusBanner";

export function CartPageHeader() {
  return (
    <>
      <NetworkStatusBanner />
      <header className="mb-8 rounded-full border border-[#ECE7DF] bg-white/90 shadow-[0_2px_10px_rgba(22,33,43,0.04)] backdrop-blur-md">
        <div className="grid min-h-14 grid-cols-[1fr_auto_1fr] items-center px-6 py-3">
          <span aria-hidden="true" />
          <Link href="/" aria-label="Garmops home" className="flex items-center justify-center justify-self-center">
            <Image src="/logo3.png" alt="Garmops" width={908} height={114} className="block h-5 w-auto object-contain" preload />
          </Link>
          <span aria-hidden="true" />
        </div>
      </header>
    </>
  );
}
