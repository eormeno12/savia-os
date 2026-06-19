import styles from "./savia-particles.module.css";
import { BRAND_COLORS } from "@/lib/constants";

const PATH =
  "M42.2 0H63.8A7.2 7.2 0 0 1 71 7.2V28.8A7.2 7.2 0 0 1 63.8 36H42.2C38.8 36 36 38.8 36 42.2V63.8A7.2 7.2 0 0 1 28.8 71H7.2A7.2 7.2 0 0 1 0 63.8V42.2A7.2 7.2 0 0 1 7.2 35H28.8C32.2 35 35 32.2 35 28.8V7.2A7.2 7.2 0 0 1 42.2 0Z";

const WHITE = "#ffffff";

type Anim = "a" | "b" | "c" | "d";

// Two kinds of particle:
//  - "lime": single lime layer, visible on light AND dark backgrounds.
//  - "neutral": two co-located layers (ink + white). On light sections the ink
//    layer contrasts (white ≈ invisible); on dark sections the white layer
//    contrasts (ink ≈ invisible). Same position → identical density on every
//    section regardless of scroll, with a smooth tone swap across light↔dark borders.
type LimeParticle = {
  kind: "lime";
  size: number;
  top: string;
  left: string;
  rot: number;
  opacity: number;
  anim: Anim;
  dur: number;
  delay: number;
  mobileHide?: boolean;
};

type NeutralParticle = {
  kind: "neutral";
  size: number;
  top: string;
  left: string;
  rot: number;
  inkOpacity: number;
  whiteOpacity: number;
  anim: Anim;
  dur: number;
  delay: number;
  mobileHide?: boolean;
};

type Particle = LimeParticle | NeutralParticle;

// Negative delay starts particles mid-cycle — they're already in motion on load.
const PARTICLES: Particle[] = [
  // ── Lime accents ───────────────────────────────────────────
  { kind: "lime", size: 18, top: "9%",  left: "7%",  rot: 45,  opacity: 0.24, anim: "a", dur: 11, delay: 0  },
  { kind: "lime", size: 22, top: "24%", left: "87%", rot: 225, opacity: 0.20, anim: "b", dur: 13, delay: 6  },
  { kind: "lime", size: 14, top: "61%", left: "68%", rot: 135, opacity: 0.22, anim: "c", dur: 14, delay: 3,  mobileHide: true },

  // ── Neutral — outer edges ──────────────────────────────────
  { kind: "neutral", size: 44, top: "37%", left: "2%",  rot: 180, inkOpacity: 0.06, whiteOpacity: 0.12, anim: "b", dur: 17, delay: 1,  mobileHide: true },
  { kind: "neutral", size: 20, top: "13%", left: "21%", rot: 270, inkOpacity: 0.08, whiteOpacity: 0.14, anim: "a", dur: 10, delay: 7  },
  { kind: "neutral", size: 32, top: "27%", left: "91%", rot: 90,  inkOpacity: 0.06, whiteOpacity: 0.12, anim: "d", dur: 15, delay: 4,  mobileHide: true },
  { kind: "neutral", size: 52, top: "55%", left: "83%", rot: 0,   inkOpacity: 0.05, whiteOpacity: 0.10, anim: "c", dur: 19, delay: 2,  mobileHide: true },

  // ── Neutral — lower / island zone ──────────────────────────
  { kind: "neutral", size: 28, top: "68%", left: "13%", rot: 90,  inkOpacity: 0.06, whiteOpacity: 0.12, anim: "a", dur: 13, delay: 5,  mobileHide: true },
  { kind: "neutral", size: 18, top: "76%", left: "37%", rot: 270, inkOpacity: 0.07, whiteOpacity: 0.12, anim: "d", dur: 11, delay: 9,  mobileHide: true },
  { kind: "neutral", size: 36, top: "73%", left: "82%", rot: 180, inkOpacity: 0.05, whiteOpacity: 0.10, anim: "b", dur: 16, delay: 3,  mobileHide: true },
  { kind: "neutral", size: 16, top: "82%", left: "55%", rot: 315, inkOpacity: 0.07, whiteOpacity: 0.12, anim: "c", dur: 12, delay: 8,  mobileHide: true },
  { kind: "neutral", size: 24, top: "6%",  left: "53%", rot: 135, inkOpacity: 0.05, whiteOpacity: 0.10, anim: "b", dur: 14, delay: 11, mobileHide: true },
];

const ANIM_CLASS: Record<Anim, string> = {
  a: styles.floatA,
  b: styles.floatB,
  c: styles.floatC,
  d: styles.floatD,
};

// A single shape layer (one rotated SVG of the SAVIA piece).
function Shape({ size, rot, fill, opacity }: { size: number; rot: number; fill: string; opacity: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 71 71"
      fill={fill}
      style={{
        position: "absolute",
        inset: 0,
        display: "block",
        transform: `rotate(${rot}deg)`,
        opacity,
      }}
    >
      <path d={PATH} />
    </svg>
  );
}

export function SaviaParticles() {
  return (
    <div
      aria-hidden="true"
      style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 1 }}
    >
      {PARTICLES.map((p, i) => {
        const classes = [
          styles.particle,
          ANIM_CLASS[p.anim],
          p.mobileHide ? styles.mobileHidden : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <div
            key={i}
            className={classes}
            style={{
              top: p.top,
              left: p.left,
              width: p.size,
              height: p.size,
              animationDuration: `${p.dur}s`,
              animationDelay: `-${p.delay}s`,
            }}
          >
            {p.kind === "lime" ? (
              <Shape size={p.size} rot={p.rot} fill={BRAND_COLORS.lime} opacity={p.opacity} />
            ) : (
              <>
                {/* Ink layer — contrasts on light sections */}
                <Shape size={p.size} rot={p.rot} fill={BRAND_COLORS.ink} opacity={p.inkOpacity} />
                {/* White layer — contrasts on dark sections */}
                <Shape size={p.size} rot={p.rot} fill={WHITE} opacity={p.whiteOpacity} />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
