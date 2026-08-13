import { captureAnalytics } from "@/lib/analytics/client";
import type { AnalyticsEvent } from "@/lib/analytics/events";

export type ConfiguratorAnalyticsEvent =
  | "stage_viewed"
  | "stage_completed"
  | "product_viewed"
  | "product_selected"
  | "product_compared"
  | "target_date_selected"
  | "colour_selected"
  | "artwork_upload_started"
  | "artwork_upload_succeeded"
  | "artwork_upload_failed"
  | "artwork_processing_started"
  | "artwork_processing_ready"
  | "artwork_processing_fallback_raster"
  | "artwork_vectorization_succeeded"
  | "artwork_vectorization_failed"
  | "artwork_background_detected"
  | "artwork_background_removed"
  | "artwork_processing_needs_review"
  | "technique_recommended"
  | "technique_selected"
  | "artwork_skipped"
  | "artwork_placement_reset"
  | "artwork_left_chest_applied"
  | "artwork_copied_to_front"
  | "neck_label_skipped"
  | "configuration_undo"
  | "configuration_redo"
  | "configuration_reset"
  | "added_to_cart"
  | "cart_item_duplicated"
  | "cart_item_updated"
  | "size_allocation_edited"
  | "approval_pdf_started"
  | "approval_pdf_downloaded"
  | "approval_pdf_failed"
  | "company_form_started"
  | "checkout_validation_error"
  | "durable_order_submitted"
  | "durable_order_failed"
  | "payment_started"
  | "payment_failed"
  | "payment_completed";

export interface ConfiguratorAnalyticsPayload {
  event: ConfiguratorAnalyticsEvent;
  properties?: Record<string, string | number | boolean | null | undefined>;
}

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

/**
 * Lightweight analytics bridge. It works without a vendor, while remaining
 * compatible with GTM/GA through `window.dataLayer` and with a custom listener
 * through the `garmops:analytics` browser event.
 */
export function trackConfiguratorEvent(
  event: ConfiguratorAnalyticsEvent,
  properties: ConfiguratorAnalyticsPayload["properties"] = {}
): void {
  if (typeof window === "undefined") return;

  const payload = {
    event: `configurator_${event}`,
    configurator_event: event,
    timestamp: new Date().toISOString(),
    ...properties,
  };

  window.dispatchEvent(new CustomEvent("garmops:analytics", { detail: payload }));
  captureAnalytics(event as AnalyticsEvent, properties);
}
