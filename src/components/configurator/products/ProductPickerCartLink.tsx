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
      className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#ECE7DF] text-[#111111] transition-colors hover:border-[var(--color-teal)] hover:text-[var(--color-teal)]"
    >
      <ShoppingCart size={21} strokeWidth={1.8} />
      <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-teal)] text-[11px] font-medium text-white">
        {summary?.itemCount ?? 0}
      </span>
    </Link>
  );
}
