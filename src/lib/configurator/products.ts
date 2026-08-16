import {
  productFabricFeel,
  productFitLabel,
  products as catalogProducts,
} from "../products";
import type { ProductId } from "./pricing";
import { flatlayAssetPath } from "../publicAssets";

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
  material: string;
  details: string[];
  careInstructions: string[];
  sizes: string[];
  minimumOrderQuantity: number;
  category: string;
  bestFor: ProductUseCase[];
  fit: string;
  fabricFeel: string;
  climate: string;
  standardLeadTime: string;
  recommendedTechnique: string;
}

function getFlatlayImage(slug: string): string {
  if (slug.includes("longsleeve")) return flatlayAssetPath("longsleeve.png");
  if (slug.includes("tee")) {
    return flatlayAssetPath(slug.includes("boxy") ? "boxytee.webp" : "regulartee.png");
  }
  if (slug.includes("hoodie")) {
    return flatlayAssetPath(slug.includes("boxy") ? "boxyhoodie.webp" : "regularhoodie.webp");
  }
  if (slug.includes("polo")) return flatlayAssetPath("polo.webp");
  if (slug.includes("sweatshirt")) return flatlayAssetPath("sweatshirt.png");
  if (slug.includes("tote")) return flatlayAssetPath("totebag.webp");
  return flatlayAssetPath("boxytee.webp");
}

function deriveProductGuidance(product: (typeof catalogProducts)[number]): Pick<
  Product,
  "bestFor" | "fit" | "fabricFeel" | "climate" | "standardLeadTime" | "recommendedTechnique"
> {
  const slug = product.slug;
  const fit = productFitLabel(product);
  const fabricFeel = productFabricFeel(product) ?? product.selectorFeel;
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
      recommendedTechnique: "Screen Print for a clean, durable logo",
    };
  }
  if (slug.includes("hoodie") || slug.includes("sweatshirt")) {
    return {
      bestFor: ["Premium gifting", "Employee onboarding", "Retail merchandise"],
      fit,
      fabricFeel,
      climate,
      standardLeadTime: "20–26 working days",
      recommendedTechnique: "Screen Print or DTF depending on the artwork",
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
      recommendedTechnique: "Screen Print or DTF depending on the artwork",
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
    name: product.name,
    defaultImage: flatlay,
    hoverImage: product.image ?? flatlay,
    description: product.description,
    gsm: product.gsm,
    material: product.selectorMaterial,
    details: product.details,
    careInstructions: product.careInstructions,
    sizes: product.sizes,
    minimumOrderQuantity: product.minimumOrderQuantity,
    category: product.selectorCategory,
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

export function getProductMinimumOrderQuantity(
  id: ProductId,
  options?: { customDyeMinimum?: number; colourType?: "signature" | "custom_dye" },
): number {
  const productMinimum = getProduct(id)?.minimumOrderQuantity ?? 50;
  if (options?.colourType !== "custom_dye") return productMinimum;
  return Math.max(productMinimum, options.customDyeMinimum ?? productMinimum);
}
