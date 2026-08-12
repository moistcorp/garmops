"use client";

import { useEffect } from "react";

import { useCartStore } from "@/lib/store";

export function shouldClearPaidSampleCart(paid: boolean): boolean {
  return paid;
}

export default function ClearPaidSampleCart({ paid }: { paid: boolean }) {
  const clearCart = useCartStore((state) => state.clearCart);

  useEffect(() => {
    if (shouldClearPaidSampleCart(paid)) clearCart();
  }, [clearCart, paid]);

  return null;
}
