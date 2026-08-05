import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import ConfigureClient from "@/components/configurator/ConfigureClient";
import { getProduct } from "@/lib/configurator/products";

interface ConfiguratorBuildPageProps {
  params: Promise<{ configId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ConfiguratorBuildPage({
  params,
  searchParams,
}: ConfiguratorBuildPageProps) {
  const { configId } = await params;
  const product = getProduct(configId);

  if (!product) {
    notFound();
  }

  const query = await searchParams;
  const hasPersistentIdentity = Boolean(
    query.draftId || query.designId || query.itemId
  );

  if (!hasPersistentIdentity) {
    const next = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (typeof value === "string") next.set(key, value);
      else value?.forEach((entry) => next.append(key, entry));
    });
    next.set("draftId", randomUUID());
    redirect(`/configurator/build/${encodeURIComponent(configId)}?${next.toString()}`);
  }

  return <ConfigureClient configId={configId} product={product} />;
}
