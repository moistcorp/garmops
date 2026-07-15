import ConfigureClient from "@/components/configurator/ConfigureClient";

interface ConfiguratorBuildPageProps {
  params: Promise<{ configId: string }>;
}

export default async function ConfiguratorBuildPage({
  params,
}: ConfiguratorBuildPageProps) {
  const { configId } = await params;

  return <ConfigureClient configId={configId} />;
}