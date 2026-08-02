import type { CloudDesignSnapshot } from "@/lib/designs/schema";

export type EstimateLineItem = {
  label: string;
  quantity: number;
  unitPricePaise: number;
  totalPaise: number;
};

export type EstimatePricingResult = {
  pricingEngineVersion: string;
  baseUnitPricePaise: number;
  configuredUnitPricePaise: number;
  discountedUnitPricePaise: number;
  subtotalPaise: number;
  discountPaise: number;
  taxableSubtotalPaise: number;
  gstRateBasisPoints: number;
  gstPaise: number;
  shippingPaise: number | null;
  totalPaise: number;
  reservationFeePaise: number;
  balanceDuePaise: number;
  lineItems: EstimateLineItem[];
};

export type EstimateCompanySnapshot = {
  companyName: string;
  contactName: string;
  contactEmail: string;
  gstin: string | null;
  billingCity: string | null;
  billingState: string | null;
};

export type EstimateSnapshot = {
  schemaVersion: 1;
  pricingEngineVersion: string;
  product: {
    id: string;
    name: string;
    baseUnitPricePaise: number;
  };
  quantity: number;
  colour: {
    type: "signature" | "custom_dye";
    name: string;
    hex: string;
  };
  customisation: {
    front: { present: boolean; technique?: string; width?: number; height?: number; placement?: string; fileName?: string };
    back: { present: boolean; technique?: string; width?: number; height?: number; placement?: string; fileName?: string };
    neckLabel: { present: boolean; dimensions?: string; position?: string; fileName?: string };
  };
  lineItems: EstimateLineItem[];
  discount: { percent: number; amountPaise: number };
  tax: { rateBasisPoints: number; amountPaise: number };
  shipping: { included: false; amountPaise: null; note: string };
  company: EstimateCompanySnapshot;
  termsVersion: "estimate-v1";
};

export type EstimateStatus = "active" | "expired" | "superseded" | "converted" | "cancelled";

export type EstimateRecord = {
  id: string;
  organization_id: string;
  created_by: string;
  design_project_id: string;
  design_version_id: string;
  design_revision: number;
  estimate_number: string;
  status: EstimateStatus;
  currency: string;
  pricing_engine_version: string;
  pricing_snapshot: EstimateSnapshot;
  subtotal_paise: number;
  discount_paise: number;
  taxable_subtotal_paise: number;
  gst_rate_basis_points: number;
  gst_paise: number;
  shipping_paise: number | null;
  total_paise: number;
  reservation_fee_paise: number;
  balance_due_paise: number;
  generated_at: string;
  valid_until: string;
  converted_order_id: string | null;
  created_at: string;
};

export type EstimateDesignInput = CloudDesignSnapshot;
