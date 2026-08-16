# Configurator preview performance

The renderer loads exactly the active view's mask, texture, shadow and highlight through one cached `Promise.all`; Front, Back and Neck are not mounted eagerly. The LRU is intentionally capped at two views. A likely next view may therefore reuse a recent entry without unbounded memory growth. No Worker/OffscreenCanvas migration was made.

The photographic render ceiling remains 3000 px because no visual evidence justified reducing it. Asset normalization removes unused colour entropy while preserving mask alpha, rounded luminance, dimensions and framing. Renderer and flatlay files are served from the versioned R2 public-assets origin with one-year immutable cache metadata. Changing renderer assets requires uploading a new version and changing the centralized version constant; production objects are never overwritten in place.

Desktop and CPU-throttled render timing require a representative browser/device profile and should be recorded in the deployment performance review. This repository does not invent lab timings.
