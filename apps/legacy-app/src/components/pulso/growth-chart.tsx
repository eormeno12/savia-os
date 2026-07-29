"use client";

import { useId, useMemo } from "react";
import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import type { GrowthPoint } from "@savia-os/contracts";
import { tokenVar } from "@/lib/token-var";

const limeVar = tokenVar("colors.signalLime");
const paperVar = tokenVar("colors.paper");

interface GrowthChartProps {
  points: GrowthPoint[];
  todayTotal: number;
  weekTotal: number;
  weekDelta: number;
}

/** SVG canvas — scales uniformly (no preserveAspectRatio=none) so dots stay round. */
const W = 320;
const H = 110;
const PAD_TOP = 10;
const PAD_BOTTOM = 6;

/** "2026-06-24" → "24 jun" (null when the bucket isn't a parseable date). */
function bucketLabel(bucket: string): string | null {
  const d = new Date(bucket.length === 10 ? `${bucket}T00:00:00` : bucket);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

/** Catmull-Rom → cubic bézier: the organic "living" curve instead of hard segments. */
function smoothLine(pts: ReadonlyArray<readonly [number, number]>): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)},${c2x.toFixed(1)} ${c2y.toFixed(1)},${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

/**
 * "Crecimiento" — the hero number of Pulso (week total, lime on ink) over a
 * smooth lime area curve of the last days. Inline SVG, zero chart deps; every
 * color goes through `tokenVar` so the tokens-or-nothing rule holds inside SVG.
 */
export function GrowthChart({ points, todayTotal, weekTotal, weekDelta }: GrowthChartProps) {
  const gradientId = useId();

  const series = useMemo(() => {
    // Aggregate per-area buckets into one total-growth series, oldest → newest.
    const byBucket = new Map<string, number>();
    for (const p of points) byBucket.set(p.bucket, (byBucket.get(p.bucket) ?? 0) + p.count);
    return [...byBucket.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }, [points]);

  const geometry = useMemo(() => {
    if (series.length === 0) return null;
    const max = Math.max(1, ...series.map(([, v]) => v));
    const step = series.length > 1 ? W / (series.length - 1) : W;
    const pts = series.map(
      ([, v], i) => [i * step, H - PAD_BOTTOM - (v / max) * (H - PAD_TOP - PAD_BOTTOM)] as const,
    );
    const line = smoothLine(pts);
    const area = `${line} L${W} ${H} L0 ${H} Z`;
    const last = pts[pts.length - 1];
    return { line, area, last };
  }, [series]);

  const firstLabel = series.length > 1 ? bucketLabel(series[0][0]) : null;
  const lastLabel = series.length > 0 ? bucketLabel(series[series.length - 1][0]) : null;

  return (
    <Stack gap="4">
      <Box>
        <Text textStyle="label" color="fg.inverse/55">
          Crecimiento
        </Text>
        <HStack align="baseline" gap="3" mt="3">
          <Text as="p" textStyle="heroNumber" color="lime.solid">
            {weekTotal.toLocaleString("es-AR")}
          </Text>
          {weekDelta !== 0 ? (
            <Text
              textStyle="caption"
              fontWeight="500"
              color={weekDelta > 0 ? "fg.inverse/70" : "fg.inverse/45"}
              fontVariantNumeric="tabular-nums"
            >
              {weekDelta > 0 ? "+" : ""}
              {weekDelta.toLocaleString("es-AR")} vs. anterior
            </Text>
          ) : null}
        </HStack>
        <Text textStyle="caption" color="fg.inverse/55" mt="1">
          recuerdos nuevos esta semana
        </Text>
      </Box>

      <Box>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }} aria-hidden>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={limeVar} stopOpacity="0.32" />
              <stop offset="100%" stopColor={limeVar} stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Minimal grid: two hairlines + baseline, paper at whisper opacity. */}
          {[0.33, 0.66].map((t) => (
            <line
              key={t}
              x1="0"
              x2={W}
              y1={PAD_TOP + (H - PAD_TOP - PAD_BOTTOM) * t}
              y2={PAD_TOP + (H - PAD_TOP - PAD_BOTTOM) * t}
              stroke={paperVar}
              strokeOpacity="0.06"
              strokeWidth="1"
            />
          ))}
          <line
            x1="0"
            x2={W}
            y1={H - PAD_BOTTOM}
            y2={H - PAD_BOTTOM}
            stroke={paperVar}
            strokeOpacity="0.14"
            strokeWidth="1"
          />
          {geometry ? (
            <>
              <path d={geometry.area} fill={`url(#${gradientId})`} />
              <path
                d={geometry.line}
                fill="none"
                stroke={limeVar}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              {/* Today's point — the curve lands on "now". */}
              <circle cx={geometry.last[0]} cy={geometry.last[1]} r="6" fill={limeVar} fillOpacity="0.22" />
              <circle cx={geometry.last[0]} cy={geometry.last[1]} r="2.7" fill={limeVar} />
            </>
          ) : null}
        </svg>
        {firstLabel || lastLabel ? (
          <HStack justify="space-between" mt="1.5">
            <Text textStyle="caption" fontSize="11px" color="fg.inverse/45" fontVariantNumeric="tabular-nums">
              {firstLabel ?? ""}
            </Text>
            <Text textStyle="caption" fontSize="11px" color="fg.inverse/45" fontVariantNumeric="tabular-nums">
              {lastLabel ?? ""}
            </Text>
          </HStack>
        ) : null}
      </Box>

      <HStack
        justify="space-between"
        borderTopWidth="1px"
        borderColor="border.inverse"
        pt="3"
      >
        <Text textStyle="caption" color="fg.inverse/55">
          Hoy
        </Text>
        <Text textStyle="caption" color="fg.inverse" fontWeight="600" fontVariantNumeric="tabular-nums">
          {todayTotal.toLocaleString("es-AR")}{" "}
          <Box as="span" fontWeight="400" color="fg.inverse/55">
            {todayTotal === 1 ? "recuerdo" : "recuerdos"}
          </Box>
        </Text>
      </HStack>
    </Stack>
  );
}
