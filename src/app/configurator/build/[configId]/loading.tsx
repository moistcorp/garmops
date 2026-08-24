import GarmopsLoadingScreen from "@/components/common/GarmopsLoadingScreen";

export default function ConfiguratorBuildLoading() {
  return (
    <GarmopsLoadingScreen
      statusText="Opening selected product…"
      title="Opening your configurator"
      description="Starting the selected product and its preview workspace."
      stages={[
        { label: "Workspace", state: "loading" },
        { label: "Front", state: "queued" },
        { label: "Back", state: "queued" },
        { label: "Neck", state: "queued" },
      ]}
    />
  );
}
