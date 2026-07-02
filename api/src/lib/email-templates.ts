/**
 * Branded, email-client-safe HTML templates for Cloak.
 * Table-based layout + inline styles for maximum compatibility (Gmail, Outlook,
 * Apple Mail). Colors mirror the desktop app's indigo/dark theme.
 */

const BRAND = '#6366f1';
const BRAND_DARK = '#4f46e5';
const INK = '#14171e';
const MUTED = '#6b7280';
const BORDER = '#e4e6ea';
const CANVAS = '#f6f7f9';

interface EmailContent {
  preheader: string;
  heading: string;
  intro: string;
  /** Optional big monospace code block (OTP). */
  code?: string;
  codeCaption?: string;
  /** Optional paragraphs after the code. */
  body?: string[];
  footerNote?: string;
}

function shieldLogo(): string {
  // Inline SVG shield; degrades to the "Cloak" wordmark if stripped.
  return `
    <span style="display:inline-block;vertical-align:middle;width:28px;height:28px;background:${BRAND};border-radius:8px;text-align:center;line-height:28px;color:#ffffff;font-weight:700;font-family:Arial,Helvetica,sans-serif;font-size:15px;">C</span>
    <span style="display:inline-block;vertical-align:middle;margin-left:10px;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;letter-spacing:-0.2px;color:#ffffff;">Cloak</span>`;
}

export function renderEmail(c: EmailContent): string {
  const bodyParas = (c.body ?? [])
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:${INK};">${p}</p>`,
    )
    .join('');

  const codeBlock = c.code
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">
        <tr>
          <td align="center">
            <div style="display:inline-block;padding:18px 28px;background:${CANVAS};border:1px solid ${BORDER};border-radius:12px;">
              <span style="font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:${INK};">${c.code}</span>
            </div>
            ${
              c.codeCaption
                ? `<div style="margin-top:10px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${MUTED};">${c.codeCaption}</div>`
                : ''
            }
          </td>
        </tr>
      </table>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${c.heading}</title>
</head>
<body style="margin:0;padding:0;background:${CANVAS};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${c.preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CANVAS};padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:100%;background:#ffffff;border:1px solid ${BORDER};border-radius:16px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:${INK};padding:22px 32px;">
              ${shieldLogo()}
            </td>
          </tr>
          <!-- Accent rule -->
          <tr><td style="height:3px;background:linear-gradient(90deg,${BRAND},${BRAND_DARK});font-size:0;line-height:0;">&nbsp;</td></tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;color:${INK};">${c.heading}</h1>
              <p style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:${INK};">${c.intro}</p>
              ${codeBlock}
              ${bodyParas}
              ${
                c.footerNote
                  ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
                      <tr><td style="padding:14px 16px;background:${CANVAS};border-radius:10px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:${MUTED};">${c.footerNote}</td></tr>
                     </table>`
                  : ''
              }
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid ${BORDER};">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:${MUTED};">
                Cloak is a zero-knowledge vault — we never see your master password or your secrets.
                You're receiving this because someone used this address to access Cloak.
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${MUTED};">© Cloak</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
