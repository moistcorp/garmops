import { products as catalogProducts } from "../products";
import type { ProductId } from "./pricing";

export type ProductUseCase =
  | "Employee onboarding"
  | "Staff uniforms"
  | "Company events"
  | "Premium gifting"
  | "Retail merchandise";

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
  category: string;
  bestFor: ProductUseCase[];
  fit: string;
  fabricFeel: string;
  climate: string;
  standardLeadTime: string;
  recommendedTechnique: string;
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

function deriveProductGuidance(product: (typeof catalogProducts)[number]): Pick<
  Product,
  "bestFor" | "fit" | "fabricFeel" | "climate" | "standardLeadTime" | "recommendedTechnique"
> {
  const slug = product.slug;
  const fit = slug.includes("boxy") ? "Relaxed boxy" : slug.includes("tote") ? "One size" : "Regular unisex";
  const fabricFeel =
    product.gsm >= 320
      ? "Warm and substantial"
      : product.gsm >= 260
        ? "Premium and structured"
        : product.gsm >= 220
          ? "Midweight"
          : "Everyday breathable";
  const climate =
    product.gsm >= 300
      ? "Cool weather / air-conditioned spaces"
      : product.gsm >= 250
        ? "Year-round, slightly warm"
        : "Warm weather and everyday indoor use";

  if (slug.includes("polo")) {
    return {
      bestFor: ["Staff uniforms", "Company events", "Premium gifting"],
      fit,
      fabricFeel,
      climate,
      standardLeadTime: "18–24 working days",
      recommendedTechnique: "Embroidery for a professional finish",
    };
  }
  if (slug.includes("hoodie") || slug.includes("sweatshirt")) {
    return {
      bestFor: ["Premium gifting", "Employee onboarding", "Retail merchandise"],
      fit,
      fabricFeel,
      climate,
      standardLeadTime: "20–26 working days",
      recommendedTechnique: "Embroidery or screen print",
    };
  }
  if (slug.includes("tote")) {
    return {
      bestFor: ["Company events", "Premium gifting", "Retail merchandise"],
      fit,
      fabricFeel: "Durable natural canvas",
      climate: "All seasons",
      standardLeadTime: "16–22 working days",
      recommendedTechnique: "Screen print for bold logos",
    };
  }
  if (product.gsm >= 260) {
    return {
      bestFor: ["Premium gifting", "Retail merchandise", "Company events"],
      fit,
      fabricFeel,
      climate,
      standardLeadTime: "18–24 working days",
      recommendedTechnique: "Screen print, puff or embroidery",
    };
  }
  return {
    bestFor: ["Employee onboarding", "Company events", "Staff uniforms"],
    fit,
    fabricFeel,
    climate,
    standardLeadTime: "16–22 working days",
    recommendedTechnique: "Screen print for value at scale",
  };
}

export const products: Product[] = catalogProducts.map((product) => {
  const flatlay = getFlatlayImage(product.slug);
  return {
    id: product.slug,
    name: product.pricingKey,
    defaultImage: flatlay,
    hoverImage: product.image ?? flatlay,
    description: product.description,
    gsm: product.gsm,
    details: product.details,
    careInstructions: product.careInstructions,
    sizes: product.sizes,
    category: product.category,
    ...deriveProductGuidance(product),
  };
});

export const PRODUCT_USE_CASES: ProductUseCase[] = [
  "Employee onboarding",
  "Staff uniforms",
  "Company events",
  "Premium gifting",
  "Retail merchandise",
];

export function getProduct(id: ProductId): Product | undefined {
  return products.find((p) => p.id === id);
}
