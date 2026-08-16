import {
  configuratorSampleAssetUrl,
  isConfiguratorSampleAssetFilename,
} from "@/lib/configurator/sampleAssets";

const MAX_SAMPLE_ASSET_BYTES = 1024 * 1024;

export async function GET(
  _request: Request,
  context: { params: Promise<{ filename: string }> },
) {
  const { filename } = await context.params;
  if (!isConfiguratorSampleAssetFilename(filename)) {
    return Response.json({ error: "Sample asset not found" }, { status: 404 });
  }

  try {
    const upstream = await fetch(configuratorSampleAssetUrl(filename), {
      cache: "force-cache",
    });
    if (!upstream.ok) {
      return Response.json(
        { error: "Sample asset is unavailable" },
        { status: 502 },
      );
    }

    const content = await upstream.arrayBuffer();
    if (content.byteLength > MAX_SAMPLE_ASSET_BYTES) {
      return Response.json(
        { error: "Sample asset is too large" },
        { status: 502 },
      );
    }

    return new Response(content, {
      headers: {
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "Content-Type": upstream.headers.get("content-type") ?? "image/svg+xml",
      },
    });
  } catch {
    return Response.json(
      { error: "Sample asset could not be loaded" },
      { status: 502 },
    );
  }
}
