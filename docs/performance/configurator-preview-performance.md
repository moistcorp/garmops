# Configurator preview performance

The configurator mounts and renders the selected product's Front, Back and Neck canvases behind a determinate loading screen. Its percentage is derived from restored workspace state, twelve completed garment-layer loads, and three completed composites. The workspace is only revealed after all three views settle, so changing preview tabs is a cheap opacity crossfade with no new asset request or compositor startup. The canvases remain mounted for instant angle changes; the layer-data LRU remains capped at two processed entries to limit additional retained memory. No Worker/OffscreenCanvas migration was made.

The photographic render ceiling remains 3000 px because no visual evidence justified reducing it. Asset normalization removes unused colour entropy while preserving mask alpha, rounded luminance, dimensions and framing. Renderer and flatlay files are served from the versioned R2 public-assets origin with one-year immutable cache metadata. Changing renderer assets requires uploading a new version and changing the centralized version constant; production objects are never overwritten in place.

Desktop and CPU-throttled render timing require a representative browser/device profile and should be recorded in the deployment performance review. This repository does not invent lab timings.
