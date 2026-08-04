import { getProduct } from "@/lib/configurator/products";

export function hsnCodeForProduct(productId: string): string {
  const product = getProduct(productId);
  const category = product?.category?.toLowerCase() ?? "";
  const name = product?.name?.toLowerCase() ?? "";

  if (category.includes("tote") || name.includes("tote")) return "4202";
  if (
    category.includes("hoodie") ||
    category.includes("sweatshirt") ||
    name.includes("hoodie") ||
    name.includes("sweatshirt")
  ) {
    return "6110";
  }
  return "610910";
}
