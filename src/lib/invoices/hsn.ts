import { getProduct } from "@/lib/configurator/products";
import { hsnCodeForProduct as hsnCodeFromTax } from "@/lib/tax";

export function hsnCodeForProduct(productId: string): string {
  const configuredCode = hsnCodeFromTax(productId);
  if (configuredCode) return configuredCode;
  const product = getProduct(productId);
  const category = product?.category?.toLowerCase() ?? "";
  const name = product?.name?.toLowerCase() ?? "";

  if (category.includes("tote") || name.includes("tote")) return "4202 22 20";
  if (
    category.includes("hoodie") ||
    category.includes("sweatshirt") ||
    name.includes("hoodie") ||
    name.includes("sweatshirt")
  ) {
    return "6110";
  }
  if (category.includes("polo") || name.includes("polo")) return "6105";
  return "6109";
}
