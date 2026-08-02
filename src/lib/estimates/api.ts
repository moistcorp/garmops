import "server-only";

import type { EstimateRecord } from "@/lib/pricing/types";
import { deriveEstimateStatus } from "./presentation";

export function publicEstimate(record: EstimateRecord) {
  return {
    id: record.id,
    designProjectId: record.design_project_id,
    designVersionId: record.design_version_id,
    designRevision: record.design_revision,
    estimateNumber: record.estimate_number,
    status: deriveEstimateStatus(record),
    currency: record.currency,
    pricingEngineVersion: record.pricing_engine_version,
    pricingSnapshot: record.pricing_snapshot,
    subtotalPaise: record.subtotal_paise,
    discountPaise: record.discount_paise,
    taxableSubtotalPaise: record.taxable_subtotal_paise,
    gstRateBasisPoints: record.gst_rate_basis_points,
    gstPaise: record.gst_paise,
    shippingPaise: record.shipping_paise,
    totalPaise: record.total_paise,
    reservationFeePaise: record.reservation_fee_paise,
    balanceDuePaise: record.balance_due_paise,
    generatedAt: record.generated_at,
    validUntil: record.valid_until,
    convertedOrderId: record.converted_order_id,
  };
}
