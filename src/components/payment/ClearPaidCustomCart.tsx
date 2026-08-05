"use client";

import { useEffect } from "react";

import { clearPaidCart } from "@/components/configurator/cart/cartDraft";

export default function ClearPaidCustomCart({
  cartId,
  paid,
}: {
  cartId: string | null;
  paid: boolean;
}) {
  useEffect(() => {
    if (!paid || !cartId) return;
    clearPaidCart(cartId);
  }, [cartId, paid]);

  return null;
}
