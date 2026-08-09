import type { Metadata } from "next";
import { generateMeta } from "@/lib/seo";
import { Suspense } from "react";
import ConfiguratorLandingClient from "./ConfiguratorLandingClient";

export const metadata: Metadata = generateMeta({
  title: "Online Custom Apparel Designer",
  description: "Design a bulk custom T-shirt, hoodie, polo, sweatshirt or tote online. Choose colours, upload artwork, select decoration and order from 50 pieces.",
  path: "/configurator",
  keywords: [
    "online custom T-shirt designer India",
    "custom apparel configurator",
    "design branded merchandise online",
    "bulk T-shirt design tool",
  ],
});

export default function ConfiguratorPage() {
  return <Suspense fallback={<main className="min-h-screen" aria-label="Loading configurator"/>}><ConfiguratorLandingClient /></Suspense>;
}
