"use client";
/**
 * The order send-off: the customer's file drops into the printer and their
 * model prints layer by layer, then the shared scene packs it into the red
 * box, rides the conveyor and sails off on the Benchy.
 */
import { motion } from "framer-motion";
import { SendOff, type Intro, type PayResult } from "@/components/sendoff/SendOff";
import type { Silhouette } from "@/lib/order/silhouette";

export type { PayResult };

const DROP_S = 1;
const PRINT_S = 3.2;
const LAYERS = 30;
/** The Benchy takes a little longer here than on the gift card page. */
const SAIL_MS = 6000;
/** Side-to-side sweeps of the nozzle while printing. */
const SWEEPS = 14;
/** Where the model prints inside the printer window (scene units). */
const AREA = { x: 245, y: 118, w: 110, h: 140 };
/** Jumps a layer at a time instead of gliding. */
const layered = (t: number) => Math.min(1, Math.floor(t * LAYERS) / LAYERS);

export function OrderAnimation({ result, fileName, model, color, onDone }: { result: PayResult; fileName: string; model: Silhouette | null; color: string; onDone: () => void }) {
  const intro: Intro = { ms: (DROP_S + PRINT_S + 0.5) * 1000, render: (viewBox, className) => <Printer viewBox={viewBox} className={className} fileName={fileName} model={model} color={color} /> };
  return <SendOff result={result} label="Placing your order" intro={intro} contents={<Part model={model} color={color} box={{ x: 252, y: 210, w: 96, h: 80 }} />} sailMs={SAIL_MS} onDone={onDone} />;
}

/** The printed part: the customer's model, or a simple block if the shape isn't available. */
function Part({ model, color, box }: { model: Silhouette | null; color: string; box: { x: number; y: number; w: number; h: number } }) {
  if (!model) return <rect x={box.x + box.w * 0.2} y={box.y + box.h * 0.2} width={box.w * 0.6} height={box.h * 0.8} rx="6" fill={color} />;
  return <image href={model.src} x={box.x} y={box.y} width={box.w} height={box.h} preserveAspectRatio="xMidYMax meet" />;
}

function Printer({ viewBox, className, fileName, model, color }: { viewBox: string; className: string; fileName: string; model: Silhouette | null; color: string }) {
  const short = fileName.length > 16 ? `${fileName.slice(0, 13)}…` : fileName;
  const top = AREA.y;
  const bed = AREA.y + AREA.h;
  const printing = { delay: DROP_S, duration: PRINT_S, ease: layered };
  // Back and forth while printing, ending in the middle when the last layer is done.
  const sweep = [0, ...Array.from({ length: SWEEPS }, (_, i) => (i % 2 ? 48 : -48)), 0];
  return (
    <svg viewBox={viewBox} preserveAspectRatio="xMidYMid meet" className={className} aria-hidden>
      <defs>
        {/* Reveals the model from the bed up, one layer at a time */}
        <clipPath id="print-reveal">
          <motion.rect x={AREA.x - 10} width={AREA.w + 20} initial={{ y: bed, height: 0 }} animate={{ y: top, height: AREA.h }} transition={printing} />
        </clipPath>
      </defs>
      {/* Floor shadow and printer body */}
      <ellipse cx="300" cy="306" rx="120" ry="10" fill="#000" opacity={0.12} />
      <rect x="196" y="48" width="208" height="254" rx="16" fill="#2b3846" />
      <rect x="258" y="48" width="84" height="7" rx="3" fill="#111a22" />
      {/* Window into the build chamber */}
      <rect x="216" y="86" width="168" height="186" rx="10" fill="#101a24" />
      <rect x="228" y={bed} width="144" height="8" rx="3" fill="#5a6b7c" />

      {/* The model appears layer by layer */}
      <g clipPath="url(#print-reveal)">
        <Part model={model} color={color} box={AREA} />
      </g>

      {/* Gantry and nozzle wait for the file, then climb a layer at a time and stop on the top layer */}
      <motion.g initial={{ y: bed }} animate={{ y: top }} transition={printing}>
        <rect x="220" y="-22" width="160" height="5" rx="2" fill="#6b7c8d" />
        <motion.g initial={{ x: 0 }} animate={{ x: sweep }} transition={{ delay: DROP_S, duration: PRINT_S, ease: "linear" }}>
          <rect x="288" y="-30" width="24" height="16" rx="4" fill="#c9d3dd" />
          <path d="M295 -14h10l-3 9h-4z" fill="#c9d3dd" />
          <circle cx="300" cy="-3" r="2.5" fill={GOLD_GLOW} />
        </motion.g>
      </motion.g>

      {/* Glass sheen, status light */}
      <rect x="216" y="86" width="168" height="186" rx="10" fill="#ffffff" opacity={0.04} />
      <motion.circle cx="384" cy="68" r="5" fill="#3ccf8e" animate={{ opacity: [1, 0.35, 1] }} transition={{ duration: 0.9, repeat: Infinity }} />

      {/* Their file drops into the slot on top */}
      <motion.g initial={{ y: -230, opacity: 1 }} animate={{ y: [-230, 0, 26], opacity: [1, 1, 0], scaleY: [1, 1, 0.2] }} transition={{ duration: DROP_S, times: [0, 0.7, 1], ease: "easeIn" }} style={{ originX: "300px", originY: "40px" }}>
        <path d="M272 -40h40l16 16v62h-56z" fill="#ffffff" />
        <path d="M312 -40v16h16" fill="#dfe8f1" />
        <text x="300" y="6" textAnchor="middle" fontSize="15" fontWeight="700" fill="#0e4471" fontFamily="var(--font-geist-mono)">
          STL
        </text>
        <text x="300" y="58" textAnchor="middle" fontSize="11" fill="var(--muted)" fontFamily="var(--font-geist-sans)">
          {short}
        </text>
      </motion.g>
    </svg>
  );
}

const GOLD_GLOW = "#e9c46a";
