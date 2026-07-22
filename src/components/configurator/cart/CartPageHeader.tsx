import Link from "next/link";
import Image from "next/image";

export function CartPageHeader() {
  return (
    <header className="relative h-12">
      <Link
        href="/"
        aria-label="Garmops home"
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
      >
        <Image src="/logo3.png" alt="Garmops" width={140} height={36} className="h-9 w-auto object-contain" />
      </Link>
    </header>
  );
}
