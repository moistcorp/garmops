import type { ProductId } from "./pricing";

export interface Product {
  id: ProductId;
  name: string;
  defaultImage: string;
  hoverImage: string;
}

// PLACEHOLDER catalogue — swap ids/names/images for real data.
// ids below are NOT guaranteed to exist in pricing.ts's internal catalogue.
export const products: Product[] = [
  {
    id: "tshirt-classic",
    name: "Classic Tee",
    defaultImage: "/configurator/placeholders/tshirt-classic-flat.jpg",
    hoverImage: "/configurator/placeholders/tshirt-classic-model.jpg",
  },
  {
    id: "hoodie-classic",
    name: "Classic Hoodie",
    defaultImage: "/configurator/placeholders/hoodie-classic-flat.jpg",
    hoverImage: "/configurator/placeholders/hoodie-classic-model.jpg",
  },
  {
    id: "polo-classic",
    name: "Classic Polo",
    defaultImage: "/configurator/placeholders/polo-classic-flat.jpg",
    hoverImage: "/configurator/placeholders/polo-classic-model.jpg",
  },
  {
    id: "sweatshirt-classic",
    name: "Classic Sweatshirt",
    defaultImage: "/configurator/placeholders/sweatshirt-classic-flat.jpg",
    hoverImage: "/configurator/placeholders/sweatshirt-classic-model.jpg",
  },
];

export function getProduct(id: ProductId): Product | undefined {
  return products.find((p) => p.id === id);
}