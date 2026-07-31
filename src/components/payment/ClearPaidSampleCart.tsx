"use client";

import { useEffect } from "react";

import { useCartStore } from "@/lib/store";

export default function ClearPaidSampleCart({ paid }: { paid: boolean }) {
  const clearCart = useCartStore((state) => state.clearCart);

  useEffect(() => {
    if (paid) clearCart();
  }, [clearCart, paid]);

  return null;
}
