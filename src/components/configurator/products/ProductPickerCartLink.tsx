"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ShoppingCart } from "lucide-react";
import { readActiveCartSummary } from "@/components/configurator/cart/cartDraft";

function getSnapshot() {
  return JSON.stringify(readActiveCartSummary());
}

export default function ProductPickerCartLink() {
  const summarySnapshot = useSyncExternalStore(
    () => () => undefined,
    getSnapshot,
    () => "null"
  );
  const summary = JSON.parse(summarySnapshot) as { cartId: string; itemCount: number } | null;

  const href = summary
    ? `/configurator/cart/${encodeURIComponent(summary.cartId)}/review`
    : "/configurator";

  return (
    <Link
      href={href}
      aria-label={summary ? `Open cart with ${summary.itemCount} item(s)` : "Cart is empty"}
      className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#E5E5E5] text-[#111111] transition-colors hover:border-[#111111]"
    >
      <ShoppingCart size={21} strokeWidth={1.8} />
      <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#111111] text-[11px] font-medium text-white">
        {summary?.itemCount ?? 0}
      </span>
    </Link>
  );
}
