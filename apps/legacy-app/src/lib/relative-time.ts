/** Compact Spanish relative time ("hace 4 min", "ayer", "hace 3 días"). */
export function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  if (Number.isNaN(then)) return "—";
  const min = Math.round(diff / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return "ayer";
  if (d < 7) return `hace ${d} días`;
  const w = Math.round(d / 7);
  if (w < 5) return `hace ${w} ${w === 1 ? "semana" : "semanas"}`;
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}
