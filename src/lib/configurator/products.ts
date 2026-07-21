import { products as catalogProducts } from "../products";
import type { ProductId } from "./pricing";

export interface Product {
  id: ProductId;
  name: string;
  defaultImage: string;
  hoverImage: string;
  description: string;
  gsm: number;
  details: string[];
  careInstructions: string[];
  sizes: string[];
}

function getFlatlayImage(slug: string): string {
  if (slug.includes("longsleeve")) return "/flatlays/longsleeve.webp";
  if (slug.includes("tee")) {
    return slug.includes("boxy") ? "/flatlays/boxytee.webp" : "/flatlays/regulartee.webp";
  }
  if (slug.includes("hoodie")) {
    return slug.includes("boxy") ? "/flatlays/boxyhoodie.webp" : "/flatlays/regularhoodie.webp";
  }
  if (slug.includes("polo")) return "/flatlays/polo.webp";
  if (slug.includes("sweatshirt")) return "/flatlays/sweatshirt.webp";
  if (slug.includes("tote")) return "/flatlays/totebag.webp";
  return "/flatlays/boxytee.webp";
}

export const products: Product[] = catalogProducts.map((product) => {
  const flatlay = getFlatlayImage(product.slug);
  return {
    id: product.slug,
    name: product.pricingKey,
    defaultImage: flatlay,
    hoverImage: flatlay,
    description: product.description,
    gsm: product.gsm,
    details: product.details,
    careInstructions: product.careInstructions,
    sizes: product.sizes,
  };
});

export function getProduct(id: ProductId): Product | undefined {
  return products.find((p) => p.id === id);
}
