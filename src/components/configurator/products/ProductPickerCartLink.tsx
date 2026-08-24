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
      className="relative m-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-(--color-rule) bg-(--color-cream) text-(--color-accent) transition-colors hover:border-(--color-accent) hover:bg-(--color-accent) hover:text-white"
    >
      <ShoppingCart size={21} strokeWidth={1.8} />
      {summary && summary.itemCount > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-sm border border-(--color-accent) bg-(--color-accent) px-1 font-mono text-xs font-medium text-white">
          {summary.itemCount}
        </span>
      ) : null}
    </Link>
  );
}
