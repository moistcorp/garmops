import "server-only";

import {
  EMAIL_THEME as BRAND,
  renderEmailFooter,
  renderEmailHeader,
} from "@/lib/email/brand";
import type { PaymentKind } from "@/lib/payu";

export type PaymentEmailTemplate = {
  subject: string;
  html: string;
  text: string;
};

export type PaymentEmailDetails = {
  projectName?: string;
  items?: string;
  product?: string;
  colour?: string;
  totalQuantity?: string;
  estimatedTotal?: string;
  targetDelivery?: string;
  shippingAddress?: string;
};

type PaymentEmailInput = {
  name: string;
  transactionId: string;
  amount: string;
  kind: PaymentKind;
  supportEmail?: string;
  siteUrl: string;
  details?: PaymentEmailDetails;
};

type PaymentFailureEmailInput = PaymentEmailInput & {
  retryUrl: string;
};

type SummaryRow = {
  label: string;
  value?: string;
  multiline?: boolean;
};

function cleanText(value: unknown, maxLength = 1000): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value).replace(/\0/g, "").trim().slice(0, maxLength);
}

function escapeHtml(value: unknown, maxLength = 1000): string {
  return cleanText(value, maxLength)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeMultiline(value: unknown, maxLength = 2000): string {
  return escapeHtml(value, maxLength).replace(/\r?\n/g, "<br>");
}

function firstName(name: string): string {
  return cleanText(name, 120).split(/\s+/)[0] || "there";
}

function formatAmount(value: string): string {
  const cleaned = cleanText(value, 100);
  const numeric = Number(cleaned.replace(/[₹,\s]/g, "").replace(/^Rs\.?/i, ""));

  if (!Number.isFinite(numeric)) return cleaned;

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}

function validEmail(value?: string): string {
  const email = cleanText(value, 320);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function validHttpUrl(value: string): string {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function renderSummaryRows(rows: SummaryRow[]): string {
  return rows
    .filter((row) => cleanText(row.value))
    .map((row) => {
      const value = row.multiline
        ? escapeMultiline(row.value, 2000)
        : escapeHtml(row.value, 1000);

      if (row.multiline) {
        return `
          <tr>
            <td colspan="2" style="padding: 15px 0; border-bottom: 1px solid ${BRAND.line};">
              <div style="font-size: 11px; line-height: 16px; color: ${BRAND.muted}; text-transform: uppercase; letter-spacing: 0.7px; margin-bottom: 5px;">${escapeHtml(row.label, 80)}</div>
              <div style="font-size: 14px; line-height: 21px; color: ${BRAND.ink};">${value}</div>
            </td>
          </tr>
        `;
      }

      return `
        <tr>
          <td style="padding: 14px 12px 14px 0; border-bottom: 1px solid ${BRAND.line}; color: ${BRAND.muted}; font-size: 13px; line-height: 19px; vertical-align: top;">${escapeHtml(row.label, 80)}</td>
          <td align="right" style="padding: 14px 0 14px 12px; border-bottom: 1px solid ${BRAND.line}; color: ${BRAND.ink}; font-size: 13px; font-weight: 600; line-height: 19px; vertical-align: top;">${value}</td>
        </tr>
      `;
    })
    .join("");
}

function renderSteps(steps: string[]): string {
  return steps
    .map(
      (step, index) => `
        <tr>
          <td width="34" valign="top" style="padding: 0 10px 14px 0;">
            <div style="width: 24px; height: 24px; border: 1px solid ${BRAND.accent}; border-radius: 4px; background: ${BRAND.accentSoft}; color: ${BRAND.accentDark}; font-family: 'Courier New', Courier, monospace; font-size: 11px; font-weight: 700; line-height: 24px; text-align: center;">${String(index + 1).padStart(2, "0")}</div>
          </td>
          <td valign="top" style="padding: 2px 0 14px; color: ${BRAND.muted}; font-size: 13px; line-height: 20px;">${escapeHtml(step, 300)}</td>
        </tr>
      `
    )
    .join("");
}

function renderEmailShell({
  preheader,
  eyebrow,
  title,
  greeting,
  introduction,
  statusLabel,
  statusTone,
  summaryTitle,
  summaryRows,
  callout,
  calloutTone,
  steps,
  buttonLabel,
  buttonUrl,
  supportEmail,
}: {
  preheader: string;
  eyebrow: string;
  title: string;
  greeting: string;
  introduction: string;
  statusLabel: string;
  statusTone: "success" | "failure";
  summaryTitle: string;
  summaryRows: SummaryRow[];
  callout?: string;
  calloutTone?: "neutral" | "warning";
  steps: string[];
  buttonLabel: string;
  buttonUrl: string;
  supportEmail?: string;
}): string {
  const isSuccess = statusTone === "success";
  const statusBackground = isSuccess ? BRAND.successSoft : BRAND.dangerSoft;
  const statusColor = isSuccess ? BRAND.success : BRAND.danger;
  const safeButtonUrl = validHttpUrl(buttonUrl);
  const safeSupportEmail = validEmail(supportEmail);
  const calloutBackground =
    calloutTone === "warning" ? BRAND.warningSoft : BRAND.accentSoft;
  const calloutColor =
    calloutTone === "warning" ? BRAND.warning : BRAND.accentDark;

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${escapeHtml(title, 160)}</title>
      </head>
      <body style="margin: 0; padding: 0; background: ${BRAND.canvas}; color: ${BRAND.ink};">
        <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; color: transparent;">${escapeHtml(preheader, 180)}</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse; background: ${BRAND.canvas};">
          <tr>
            <td align="center" style="padding: 28px 12px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width: 100%; max-width: 620px; border-collapse: separate; background: ${BRAND.surface}; border: 1px solid ${BRAND.line}; border-radius: 4px; overflow: hidden;">
                ${renderEmailHeader(eyebrow)}
                <tr>
                  <td style="padding: 34px 28px 12px; font-family: Arial, Helvetica, sans-serif;">
                    <div style="display: inline-block; margin-bottom: 18px; padding: 6px 9px; border: 1px solid ${statusColor}; border-radius: 4px; background: ${statusBackground}; color: ${statusColor}; font-family: 'Courier New', Courier, monospace; font-size: 9px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase;">${escapeHtml(statusLabel, 80)}</div>
                    <h1 style="margin: 0 0 14px; color: ${BRAND.ink}; font-size: 30px; line-height: 36px; letter-spacing: -0.7px;">${escapeHtml(title, 160)}</h1>
                    <p style="margin: 0 0 8px; color: ${BRAND.ink}; font-size: 15px; line-height: 24px;">Hi ${escapeHtml(greeting, 120)},</p>
                    <p style="margin: 0; color: ${BRAND.muted}; font-size: 15px; line-height: 24px;">${escapeHtml(introduction, 600)}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 22px 28px 0; font-family: Arial, Helvetica, sans-serif;">
                    <div style="padding: 20px; border: 1px solid ${BRAND.line}; border-radius: 4px; background: ${BRAND.cream};">
                      <div style="margin-bottom: 4px; color: ${BRAND.accent}; font-family: 'Courier New', Courier, monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase;">${escapeHtml(summaryTitle, 100)}</div>
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
                        ${renderSummaryRows(summaryRows)}
                      </table>
                    </div>
                  </td>
                </tr>
                ${
                  callout
                    ? `
                <tr>
                  <td style="padding: 18px 28px 0; font-family: Arial, Helvetica, sans-serif;">
                    <div style="padding: 14px 16px; border: 1px solid ${BRAND.line}; border-left: 3px solid ${calloutColor}; border-radius: 4px; background: ${calloutBackground}; color: ${calloutColor}; font-size: 12px; line-height: 19px;">${escapeHtml(callout, 600)}</div>
                  </td>
                </tr>
                `
                    : ""
                }
                <tr>
                  <td style="padding: 26px 28px 4px; font-family: Arial, Helvetica, sans-serif;">
                    <h2 style="margin: 0 0 16px; color: ${BRAND.ink}; font-size: 16px; line-height: 22px;">What happens next</h2>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
                      ${renderSteps(steps)}
                    </table>
                  </td>
                </tr>
                ${
                  safeButtonUrl
                    ? `
                <tr>
                  <td style="padding: 16px 28px 28px; font-family: Arial, Helvetica, sans-serif;">
                    <a href="${escapeHtml(safeButtonUrl, 1000)}" style="display: inline-block; padding: 12px 18px; border-radius: 4px; background: ${BRAND.accent}; color: #FFFFFF; font-family: 'Courier New', Courier, monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.7px; line-height: 16px; text-decoration: none; text-transform: uppercase;">${escapeHtml(buttonLabel, 80)}</a>
                  </td>
                </tr>
                `
                    : ""
                }
                ${renderEmailFooter({ supportEmail: safeSupportEmail })}
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

function orderLabel(kind: PaymentKind): string {
  return kind === "sample-cart" ? "Sample order" : "Production reservation";
}

export function buildPaymentSuccessEmail(
  input: PaymentEmailInput
): PaymentEmailTemplate {
  const isSample = input.kind === "sample-cart";
  const amount = formatAmount(input.amount);
  const supportEmail = validEmail(input.supportEmail);
  const details = input.details ?? {};
  const title = isSample ? "Payment received" : "Reservation payment received";
  const introduction = isSample
    ? "Your payment was successful and your sample order is now confirmed. We’ll review the details and keep you updated as it moves toward dispatch."
    : "Your reservation fee was received successfully and your production review slot is secured. Our team will now review the configuration before production approval.";
  const steps = isSample
    ? [
        "Our team reviews the sample order and delivery details.",
        "We prepare the items and contact you if anything needs clarification.",
        "You receive a dispatch update as soon as the order is ready.",
      ]
    : [
        "Our production team reviews the garment, artwork and feasibility.",
        "We confirm final pricing, delivery timing and send the proforma invoice.",
        "Production begins after your approval and the agreed payment terms.",
      ];
  const summaryRows: SummaryRow[] = [
    { label: "Status", value: "Paid" },
    { label: "Transaction ID", value: cleanText(input.transactionId, 100) },
    { label: isSample ? "Amount paid" : "Reservation fee paid", value: amount },
    { label: "Order type", value: orderLabel(input.kind) },
    { label: "Project", value: cleanText(details.projectName, 160) },
    { label: "Items", value: cleanText(details.items, 2000), multiline: true },
    { label: "Product", value: cleanText(details.product, 300), multiline: true },
    { label: "Colour", value: cleanText(details.colour, 200) },
    { label: "Total quantity", value: cleanText(details.totalQuantity, 50) },
    { label: "Estimated order total", value: cleanText(details.estimatedTotal, 100) },
    { label: "Target delivery", value: cleanText(details.targetDelivery, 120) },
    {
      label: "Delivery address",
      value: cleanText(details.shippingAddress, 1000),
      multiline: true,
    },
  ];

  return {
    subject: `${title} — ${cleanText(input.transactionId, 100)} | Garmops`,
    html: renderEmailShell({
      preheader: `${title}. Transaction ${cleanText(input.transactionId, 100)}.`,
      eyebrow: isSample ? "Sample order" : "Production review",
      title,
      greeting: firstName(input.name),
      introduction,
      statusLabel: "Payment successful",
      statusTone: "success",
      summaryTitle: "Payment and order summary",
      summaryRows,
      callout: isSample
        ? "Please keep the transaction ID for your records."
        : "The reservation fee will be credited against your final invoice. It does not represent full payment for production.",
      calloutTone: "neutral",
      steps,
      buttonLabel: "Visit Garmops",
      buttonUrl: input.siteUrl,
      supportEmail,
    }),
    text: [
      `Hi ${firstName(input.name)},`,
      "",
      introduction,
      "",
      `Status: Paid`,
      `Transaction ID: ${cleanText(input.transactionId, 100)}`,
      `${isSample ? "Amount paid" : "Reservation fee paid"}: ${amount}`,
      `Order type: ${orderLabel(input.kind)}`,
      details.items ? `Items: ${cleanText(details.items, 2000)}` : "",
      details.product ? `Product: ${cleanText(details.product, 300)}` : "",
      details.totalQuantity
        ? `Total quantity: ${cleanText(details.totalQuantity, 50)}`
        : "",
      details.targetDelivery
        ? `Target delivery: ${cleanText(details.targetDelivery, 120)}`
        : "",
      details.shippingAddress
        ? `Delivery address: ${cleanText(details.shippingAddress, 1000)}`
        : "",
      "",
      "What happens next:",
      ...steps.map((step, index) => `${index + 1}. ${step}`),
      "",
      supportEmail
        ? `Questions? Reply to this email or contact ${supportEmail}.`
        : "",
      "Garmops — Powered by Moist Corp",
    ]
      .filter((line, index, lines) => line || lines[index - 1] !== "")
      .join("\n"),
  };
}

export function buildPaymentFailureEmail(
  input: PaymentFailureEmailInput
): PaymentEmailTemplate {
  const isSample = input.kind === "sample-cart";
  const amount = formatAmount(input.amount);
  const supportEmail = validEmail(input.supportEmail);
  const title = "Payment unsuccessful";
  const introduction = isSample
    ? "We couldn’t confirm payment for your sample order, so the order has not been placed. Your cart remains available if you want to try again."
    : "We couldn’t confirm your reservation payment, so the production review has not been reserved. Your configuration remains available if you want to try again.";
  const steps = [
    "Check that your card, UPI or bank details are correct.",
    "If no amount was deducted, use the button below to try the payment again.",
    "If money was deducted, do not retry yet—allow up to 6 hours for the bank and payment records to sync, then contact us with the transaction ID.",
  ];

  return {
    subject: `Payment unsuccessful — ${cleanText(input.transactionId, 100)} | Garmops`,
    html: renderEmailShell({
      preheader: `We could not confirm payment for transaction ${cleanText(input.transactionId, 100)}.`,
      eyebrow: "Payment update",
      title,
      greeting: firstName(input.name),
      introduction,
      statusLabel: "Not completed",
      statusTone: "failure",
      summaryTitle: "Payment attempt",
      summaryRows: [
        { label: "Status", value: "Unsuccessful" },
        { label: "Transaction ID", value: cleanText(input.transactionId, 100) },
        { label: "Attempted amount", value: amount },
        { label: "Order type", value: orderLabel(input.kind) },
        { label: "Project", value: cleanText(input.details?.projectName, 160) },
      ],
      callout:
        "If your bank shows a debit, do not make another payment immediately. Keep the transaction ID above and contact us if the payment does not reconcile within 6 hours.",
      calloutTone: "warning",
      steps,
      buttonLabel: "Try payment again",
      buttonUrl: input.retryUrl,
      supportEmail,
    }),
    text: [
      `Hi ${firstName(input.name)},`,
      "",
      introduction,
      "",
      "Status: Unsuccessful",
      `Transaction ID: ${cleanText(input.transactionId, 100)}`,
      `Attempted amount: ${amount}`,
      `Order type: ${orderLabel(input.kind)}`,
      "",
      "Important: If your bank shows a debit, do not make another payment immediately. Allow up to 6 hours for the payment records to sync, then contact us with the transaction ID.",
      "",
      "What to do next:",
      ...steps.map((step, index) => `${index + 1}. ${step}`),
      "",
      `Retry payment: ${validHttpUrl(input.retryUrl)}`,
      supportEmail
        ? `Questions? Reply to this email or contact ${supportEmail}.`
        : "",
      "Garmops — Powered by Moist Corp",
    ]
      .filter((line, index, lines) => line || lines[index - 1] !== "")
      .join("\n"),
  };
}
