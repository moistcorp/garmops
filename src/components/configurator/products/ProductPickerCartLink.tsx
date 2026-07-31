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
      className="relative m-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] border border-[var(--color-rule)] bg-[var(--color-cream)] text-[var(--color-accent)] transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-white"
    >
      <ShoppingCart size={21} strokeWidth={1.8} />
      <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-[4px] border border-[var(--color-accent)] bg-[var(--color-accent)] px-1 font-mono text-[10px] font-medium text-white">
        {summary?.itemCount ?? 0}
      </span>
    </Link>
  );
}
