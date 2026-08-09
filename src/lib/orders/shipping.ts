/** Canonical shipping policy for every currently supported Garmops order. */
export const FREE_SHIPPING_PAISE = 0 as const;

export function getShippingPaise(): typeof FREE_SHIPPING_PAISE {
  return FREE_SHIPPING_PAISE;
}
