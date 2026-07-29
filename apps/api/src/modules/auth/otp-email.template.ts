/**
 * OTP email markup. Mirrors the brand tokens from `docs/design/savia-design-system.md`
 * (§2 color, §4 CTAs, §6 typography, §9 imágenes) — backend can't import
 * `@savia-os/design-tokens` (a Chakra/Next package), so the hex values are copied
 * here deliberately.
 *
 * Voice: tuteo ("tú"), never voseo — matches the rest of the product copy
 * (apps/app, apps/landing use "puedes"/"eres"/"quieres", never "podés"/"sos").
 *
 * Table-based layout + inline styles (no <style> block, no CSS grid/flex, no
 * opacity/rgba on text) for compatibility with Outlook desktop's Word rendering
 * engine and clients that strip <head>. The OTP code is the one "metric on ink"
 * moment the design system calls for — lime, large, tabular, on the ink panel;
 * everything else stays off lime per the "lime only on dark" rule.
 *
 * The mark (§9) is a hosted PNG, not inline <svg> — Gmail strips inline SVG in
 * HTML emails, so an <img> against a real URL is the only path that renders
 * everywhere. Rasterized from `packages/ui/src/brand/savia-mark.tsx` via sharp;
 * lives at `apps/landing/public/mark-ink.png`, so it only resolves once
 * apps/landing is deployed with that file. Header sits on the light canvas, so
 * the mark is ink (not lime) here — matching the wordmark, no dark pill needed.
 */

const INK = '#0B2529';
const PAPER = '#F4F4F1';
const SIGNAL_LIME = '#E7FF18';
const SLATE_TEXT = '#53606C';
// Solid fallback for "paper at ~70% over ink" — rgba/opacity is unreliable across
// email clients, so this is baked as a flat hex instead of `paper/70`.
const PAPER_MUTED_ON_INK = '#9FB0AD';

const FONT_STACK = "Arial, Helvetica, sans-serif";
const MARK_URL = 'https://www.savia.uno/mark-ink.png';

export function otpEmailHtml(code: string): string {
  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Tu código de acceso</title>
  </head>
  <body style="margin:0;padding:0;background-color:${PAPER};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${PAPER};">
      <tr>
        <td align="center" style="padding:48px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
            <!-- Logo lockup: mark + wordmark, both ink — this header sits on the
                 light canvas, so no lime here (§2 "lima solo sobre oscuro"). -->
            <tr>
              <td align="center" style="padding-bottom:40px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td valign="middle" style="padding-right:8px;">
                      <img src="${MARK_URL}" width="18" height="18" alt="" style="display:block;" />
                    </td>
                    <td valign="middle">
                      <span style="font-family:${FONT_STACK};font-size:14px;font-weight:700;letter-spacing:0.08em;color:${INK};">SAVIA</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- The signature dark panel — where the code (a "metric") lives in lime. -->
            <tr>
              <td style="background-color:${INK};border-radius:20px;padding:44px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="padding-bottom:18px;">
                      <span style="font-family:${FONT_STACK};font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${PAPER_MUTED_ON_INK};">Tu código de acceso</span>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-bottom:22px;">
                      <span style="font-family:${FONT_STACK};font-size:46px;font-weight:700;letter-spacing:0.26em;color:${SIGNAL_LIME};">${code}</span>
                    </td>
                  </tr>
                  <tr>
                    <td align="center">
                      <span style="font-family:${FONT_STACK};font-size:14px;line-height:1.6;color:${PAPER_MUTED_ON_INK};">
                        Es de un solo uso y vale por 10 minutos.<br />No lo compartas con nadie.
                      </span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-top:32px;padding-bottom:12px;">
                <span style="font-family:${FONT_STACK};font-size:13px;line-height:1.7;color:${SLATE_TEXT};">
                  Si no fuiste tú quien lo pidió, ignora este mensaje — tu memoria sigue segura.
                </span>
              </td>
            </tr>
            <tr>
              <td align="center">
                <span style="font-family:${FONT_STACK};font-size:13px;font-weight:700;color:${INK};">La memoria que conecta todas tus IAs.</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function otpEmailText(code: string): string {
  return [
    'SAVIA',
    '',
    `Tu código de acceso: ${code}`,
    '',
    'Es de un solo uso y vale por 10 minutos. No lo compartas con nadie.',
    '',
    'Si no fuiste tú quien lo pidió, ignora este mensaje — tu memoria sigue segura.',
    '',
    'La memoria que conecta todas tus IAs.',
  ].join('\n');
}
