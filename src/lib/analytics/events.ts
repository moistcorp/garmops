export const ANALYTICS_EVENTS = [
  "product_viewed", "configurator_started", "product_selected", "colour_selected",
  "artwork_upload_succeeded", "technique_selected", "neck_label_selected",
  "size_allocation_completed", "delivery_started", "delivery_completed",
  "review_viewed", "payment_started", "payment_completed", "payment_failed",
  "order_confirmed", "saved_design_created", "stage_viewed", "stage_completed",
  "product_compared", "target_date_selected", "artwork_upload_started",
  "artwork_upload_failed", "technique_recommended", "artwork_skipped",
  "artwork_placement_reset", "artwork_left_chest_applied", "artwork_copied_to_back",
  "artwork_copied_to_front", "neck_label_skipped", "configuration_undo",
  "configuration_redo", "configuration_reset", "added_to_cart", "cart_item_duplicated",
  "cart_item_updated", "size_allocation_edited", "approval_pdf_started",
  "approval_pdf_downloaded", "approval_pdf_failed", "company_form_started",
  "checkout_validation_error", "durable_order_submitted", "durable_order_failed",
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];
export type AnalyticsProperty = string | number | boolean | null | undefined;
export type AnalyticsProperties = Record<string, AnalyticsProperty>;

const ALLOWED_PROPERTIES = new Set([
  "product_id", "product_category", "quantity_band", "colour_type",
  "front_artwork", "back_artwork", "front_technique", "back_technique",
  "custom_neck_label", "delivery_type", "new_vs_returning", "cart_line_count",
  "stage", "side", "file_type", "technique", "reason", "source",
]);

export function sanitizeAnalyticsProperties(properties: AnalyticsProperties = {}) {
  return Object.fromEntries(
    Object.entries(properties).filter(([key, value]) =>
      ALLOWED_PROPERTIES.has(key) && ["string", "number", "boolean"].includes(typeof value),
    ),
  );
}
