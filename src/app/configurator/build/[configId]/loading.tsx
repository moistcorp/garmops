import GarmopsLoadingScreen from "@/components/common/GarmopsLoadingScreen";

export default function ConfiguratorBuildLoading() {
  return (
    <GarmopsLoadingScreen
      progress={8}
      statusText="Opening selected product…"
      description="Preparing the product workspace and its garment preview. This screen will close automatically when everything is ready."
      stages={[
        { label: "Workspace", state: "loading" },
        { label: "Front", state: "queued" },
        { label: "Back", state: "queued" },
        { label: "Neck", state: "queued" },
      ]}
    />
  );
}
