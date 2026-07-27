"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ShoppingCart } from "lucide-react";
import {
  CART_DRAFT_UPDATED_EVENT,
  readActiveCartSummary,
} from "@/components/configurator/cart/cartDraft";

function getSnapshot() {
  return JSON.stringify(readActiveCartSummary());
}

function subscribe(onStoreChange: () => void) {
  function handleStorage(event: StorageEvent) {
    if (event.key?.startsWith("mf_configurator_cart:")) {
      onStoreChange();
    }
  }

  window.addEventListener(CART_DRAFT_UPDATED_EVENT, onStoreChange);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(CART_DRAFT_UPDATED_EVENT, onStoreChange);
    window.removeEventListener("storage", handleStorage);
  };
}

export default function ProductPickerCartLink() {
  const summarySnapshot = useSyncExternalStore(
    subscribe,
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
      className="relative m-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/70 bg-white/40 text-[#111111]/80 shadow-[0_3px_10px_rgba(22,33,43,0.09),inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-xl transition-colors hover:border-[var(--color-teal)]/45 hover:bg-white/60 hover:text-[var(--color-teal)]"
    >
      <ShoppingCart size={21} strokeWidth={1.8} />
      <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-white/70 bg-[var(--color-teal)]/90 text-[11px] font-medium text-white shadow-[0_2px_7px_rgba(22,33,43,0.14),inset_0_1px_0_rgba(255,255,255,0.45)] backdrop-blur-md">
        {summary?.itemCount ?? 0}
      </span>
    </Link>
  );
}
