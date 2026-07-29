/** Formatting helpers shared across the Cuenta sections. Locale: es-AR. */

/** Long human date, e.g. "3 de julio de 2026". Safe on empty/invalid input. */
export function formatLongDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
}

/** Short date, e.g. "3 jul 2026". Safe on empty/invalid input. */
export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
}

/** Currency formatting that never throws on an unknown ISO code. */
export function formatMoney(amount: number, currency: string | null | undefined): string {
  const code = (currency ?? "USD").toUpperCase();
  try {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency: code }).format(amount);
  } catch {
    return `$${amount.toFixed(2)} ${code}`;
  }
}
