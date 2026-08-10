import "server-only";

import { GARMOPS_BRAND } from "@/lib/brand";

export const EMAIL_THEME = Object.freeze({
  ink: "#16212B",
  muted: "#53606B",
  line: "#DCE1E6",
  canvas: "#F4F6F8",
  surface: "#FFFFFF",
  cream: "#FAF8F5",
  accent: "#1D49B4",
  accentDark: "#173A91",
  accentSoft: "#EDF2FF",
  success: "#276E48",
  successSoft: "#EDF7F1",
  danger: "#A62D2D",
  dangerSoft: "#FFF1F1",
  warning: "#8A6212",
  warningSoft: "#FFF8E7",
});

export function cleanEmailText(value: unknown, maxLength = 1000): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value).replace(/\0/g, "").trim().slice(0, maxLength);
}

export function escapeEmailHtml(value: unknown, maxLength = 1000): string {
  return cleanEmailText(value, maxLength)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function renderEmailHeader(eyebrow: string): string {
  return `
    <tr>
      <td style="padding: 18px 24px; border-bottom: 1px solid ${EMAIL_THEME.line}; background: ${EMAIL_THEME.surface};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td valign="middle">
              <img src="${GARMOPS_BRAND.logoUrl}" width="146" alt="Garmops" style="display: block; width: 146px; max-width: 100%; height: auto; border: 0;">
            </td>
            <td align="right" valign="middle" style="color: ${EMAIL_THEME.muted}; font-family: 'Courier New', Courier, monospace; font-size: 12px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase;">
              ${escapeEmailHtml(eyebrow, 80)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

export function renderEmailFooter(options?: {
  supportEmail?: string;
  note?: string;
}): string {
  const supportEmail = cleanEmailText(options?.supportEmail, 320);
  const safeSupportEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)
    ? supportEmail
    : "";

  return `
    <tr>
      <td style="padding: 20px 24px; border-top: 1px solid ${EMAIL_THEME.line}; background: ${EMAIL_THEME.cream}; color: ${EMAIL_THEME.muted}; font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 18px;">
        ${
          safeSupportEmail
            ? `Questions? Reply to this email or contact <a href="mailto:${escapeEmailHtml(safeSupportEmail, 320)}" style="color: ${EMAIL_THEME.accentDark}; text-decoration: underline;">${escapeEmailHtml(safeSupportEmail, 320)}</a>.<br>`
            : ""
        }
        ${options?.note ? `${escapeEmailHtml(options.note, 300)}<br>` : ""}
        Garmops &mdash; Powered by Moist Corp<br>
        Greater Noida, Uttar Pradesh, India
      </td>
    </tr>
  `;
}

export function renderBrandedEmail({
  preheader,
  eyebrow,
  title,
  bodyHtml,
  statusLabel,
  statusTone = "accent",
  action,
  supportEmail,
  footerNote,
}: {
  preheader: string;
  eyebrow: string;
  title: string;
  bodyHtml: string;
  statusLabel?: string;
  statusTone?: "accent" | "success" | "danger" | "warning";
  action?: { label: string; url: string };
  supportEmail?: string;
  footerNote?: string;
}): string {
  const tone = {
    accent: [EMAIL_THEME.accent, EMAIL_THEME.accentSoft],
    success: [EMAIL_THEME.success, EMAIL_THEME.successSoft],
    danger: [EMAIL_THEME.danger, EMAIL_THEME.dangerSoft],
    warning: [EMAIL_THEME.warning, EMAIL_THEME.warningSoft],
  }[statusTone];
  const actionUrl = (() => {
    try {
      const parsed = new URL(action?.url ?? "");
      return parsed.protocol === "https:" || parsed.protocol === "http:"
        ? parsed.toString()
        : "";
    } catch {
      return "";
    }
  })();

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${escapeEmailHtml(title, 160)}</title>
      </head>
      <body style="margin: 0; padding: 0; background: ${EMAIL_THEME.canvas}; color: ${EMAIL_THEME.ink};">
        <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; color: transparent;">${escapeEmailHtml(preheader, 180)}</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse; background: ${EMAIL_THEME.canvas};">
          <tr>
            <td align="center" style="padding: 28px 12px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width: 100%; max-width: 620px; border-collapse: separate; background: ${EMAIL_THEME.surface}; border: 1px solid ${EMAIL_THEME.line}; border-radius: 4px; overflow: hidden;">
                ${renderEmailHeader(eyebrow)}
                <tr>
                  <td style="padding: 30px 24px 8px; font-family: Arial, Helvetica, sans-serif;">
                    ${
                      statusLabel
                        ? `<div style="display: inline-block; margin-bottom: 16px; padding: 6px 9px; border: 1px solid ${tone[0]}; border-radius: 4px; background: ${tone[1]}; color: ${tone[0]}; font-family: 'Courier New', Courier, monospace; font-size: 12px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase;">${escapeEmailHtml(statusLabel, 80)}</div>`
                        : ""
                    }
                    <h1 style="margin: 0; color: ${EMAIL_THEME.ink}; font-size: 28px; line-height: 34px; letter-spacing: -0.5px;">${escapeEmailHtml(title, 160)}</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 24px 28px; color: ${EMAIL_THEME.ink}; font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 22px;">
                    ${bodyHtml}
                    ${
                      action && actionUrl
                        ? `<div style="padding-top: 20px;"><a href="${escapeEmailHtml(actionUrl, 1000)}" style="display: inline-block; padding: 12px 18px; border-radius: 4px; background: ${EMAIL_THEME.accent}; color: #FFFFFF; font-family: 'Courier New', Courier, monospace; font-size: 14px; font-weight: 700; letter-spacing: 0.7px; line-height: 18px; text-decoration: none; text-transform: uppercase;">${escapeEmailHtml(action.label, 80)}</a></div>`
                        : ""
                    }
                  </td>
                </tr>
                ${renderEmailFooter({ supportEmail, note: footerNote })}
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}
