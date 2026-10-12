"use client";
/**
 * The Thanksgiving story, same flat paper-cut style as the Christmas scenes,
 * on one clock (TG_S seconds):
 *   0 to 5.6   a country road in autumn: the truck rolls up to a farmhouse with pumpkins
 *              on the porch, and the driver carries the box to the door while leaves fall
 *   5.6 on     Thanksgiving dinner: a 3D printer in the corner prints a little pumpkin
 *              centrepiece layer by layer; Dad carries it to the table, the family cheers,
 *              the kid opens the delivered box and holds up the gift card, and everyone
 *              raises a glass
 * Loops (leaves, candle flames) are CSS with negative delays, so nothing jumps.
 */
import { motion, type Easing } from "framer-motion";
import { GOLD, GOLD_DARK } from "@/components/sendoff/SendOff";
import {
  DAD,
  DeliveryTruck,
  DriverFigure,
  KID,
  KID_SCALE,
  MOM,
  Member,
  Present,
  RoomPresent,
  TRUCK_ROLL,
  hold,
  seeded,
  swing,
  track,
  vars,
  type Anim,
  type PresentColors,
} from "./HolidayScenes";

export const TG_S = 18;
const tg = <V,>(points: [number, V][], ease?: Parameters<typeof track>[1]) => track(points, ease, TG_S);
const ROOM_AT = 5.6;
const ARRIVE: Easing = [0.22, 1, 0.36, 1];

const LEAVES = ["#d9622b", "#e9a23b", "#b8452a", "#f2c14e", "#8f3b1f"];
/** The delivered box, in autumn colours. */
const AUTUMN_BOX: PresentColors = { box: "#d9822b", lid: "#e9a04a", ribbon: "#7a3b1d", knot: "#5a2a14" };

/** Leaf fall and candle flicker, as CSS so they loop without a jump. */
function AutumnStyles() {
  return (
    <style>{`
      @keyframes cp-leaf { from { transform: translate(0, 0) rotate(0deg); } to { transform: translate(var(--dx), var(--dy)) rotate(var(--spin)); } }
      @keyframes cp-flicker { 0%, 100% { transform: scale(1, 1); opacity: 0.95; } 50% { transform: scale(0.85, 1.12); opacity: 1; } }
      .cp-leaf { animation: cp-leaf var(--t) linear var(--d) infinite; transform-box: fill-box; transform-origin: center; }
      .cp-flicker { animation: cp-flicker var(--t) ease-in-out var(--d) infinite; transform-box: fill-box; transform-origin: 50% 100%; }
      @media (prefers-reduced-motion: reduce) { .cp-leaf, .cp-flicker { animation: none; } }
    `}</style>
  );
}

/** A small maple leaf, about 10 wide, centred on (0, 0). */
const LEAF = "M0 -6l1.6 3 3-1-1 3.2 2.6 1.2-3.4 1.4.6 2.2-3.4-1V5h-0.8V3l-3.4 1 .6-2.2-3.4-1.4 2.6-1.2-1-3.2 3 1z";

/** Leaves drifting down (and sideways in the wind) across a box, starting well above the top. */
export function Leaves({ x = -200, y = -520, w = 1000, h = 900, count = 60, seed = 9, wind = 60, size = 1 }: { x?: number; y?: number; w?: number; h?: number; count?: number; seed?: number; wind?: number; size?: number }) {
  const r = seeded(count * 5, seed);
  return (
    <g aria-hidden>
      {Array.from({ length: count }, (_, i) => {
        const dur = 6 + r[i * 5 + 2] * 6;
        const s = (0.8 + r[i * 5 + 1] * 0.8) * size;
        return (
          <g key={i} transform={`translate(${(x + r[i * 5] * w).toFixed(1)} ${y}) scale(${s.toFixed(2)})`}>
            <path
              className="cp-leaf"
              d={LEAF}
              fill={LEAVES[i % LEAVES.length]}
              style={vars({ t: dur, d: -r[i * 5 + 3] * dur, dx: `${(wind + (r[i * 5 + 4] - 0.5) * 80).toFixed(0)}px`, dy: `${(h / s).toFixed(0)}px`, spin: `${r[i * 5 + 4] > 0.5 ? 540 : -540}deg` })}
            />
          </g>
        );
      })}
    </g>
  );
}

/** A round autumn tree. */
function AutumnTree({ x, y, s = 1, colors }: { x: number; y: number; s?: number; colors: [string, string] }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-4" y="-30" width="8" height="30" fill="#5b3a2c" />
      <circle cx="0" cy="-44" r="22" fill={colors[0]} />
      <circle cx="-12" cy="-36" r="14" fill={colors[1]} />
      <circle cx="13" cy="-38" r="13" fill={colors[1]} />
    </g>
  );
}

/** A pumpkin, bottom-centre at (0, 0). */
export function Pumpkin({ s = 1 }: { s?: number }) {
  return (
    <g transform={`scale(${s})`}>
      <ellipse cx="-6" cy="-8" rx="8" ry="8" fill="#d9622b" />
      <ellipse cx="6" cy="-8" rx="8" ry="8" fill="#d9622b" />
      <ellipse cx="0" cy="-8.5" rx="8" ry="8.5" fill="#e9782f" />
      <path d="M-1 -16q1-5 4-6" stroke="#4a6b2a" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </g>
  );
}

/** The farmhouse at the end of the road: cream walls, red roof, a porch with pumpkins, a door that opens. */
function Farmhouse({ door }: { door: Anim }) {
  return (
    <g>
      <rect x="430" y="150" width="20" height="40" fill="#7a3b2a" />
      <rect x="380" y="196" width="190" height="104" fill="#efe2c4" />
      <path d="M366 200L475 124L584 200Z" fill="#8f2f22" />
      <rect x="366" y="198" width="218" height="6" fill="#6f241a" />
      {/* Windows, warm and lit, with shutters */}
      <rect x="398" y="222" width="46" height="40" rx="3" fill="#f4c76b" />
      <rect x="419" y="222" width="4" height="40" fill="#efe2c4" />
      <rect x="398" y="240" width="46" height="4" fill="#efe2c4" />
      <rect x="390" y="220" width="7" height="44" fill="#4a6b2a" />
      <rect x="445" y="220" width="7" height="44" fill="#4a6b2a" />
      {/* Porch roof and posts */}
      <rect x="474" y="220" width="96" height="6" fill="#8f2f22" />
      <rect x="478" y="226" width="4" height="70" fill="#d8c8a4" />
      <rect x="562" y="226" width="4" height="70" fill="#d8c8a4" />
      {/* Warm light behind the door, then the door swinging open */}
      <rect x="490" y="232" width="40" height="66" fill="#f4c76b" />
      <motion.g initial={false} animate={{ scaleX: door.values }} transition={{ scaleX: door.t }} style={{ originX: "0%", originY: "50%" }}>
        <rect x="490" y="232" width="40" height="66" fill="#6b3a24" />
        <rect x="496" y="240" width="28" height="22" rx="2" fill="#7f4a2e" />
        {/* A wreath of leaves */}
        <circle cx="510" cy="251" r="8" fill="none" stroke="#c46a2b" strokeWidth="4.5" />
        <circle cx="523" cy="272" r="2" fill={GOLD} />
      </motion.g>
      {/* Steps with pumpkins */}
      <rect x="480" y="296" width="60" height="6" fill="#bda97e" />
      <g transform="translate(470 302)">
        <Pumpkin s={1.1} />
      </g>
      <g transform="translate(552 302)">
        <Pumpkin s={0.9} />
      </g>
      <g transform="translate(566 302)">
        <Pumpkin s={0.65} />
      </g>
    </g>
  );
}

/** Act one: the country road. */
function CountryRoad() {
  const truckX = tg(
    [
      [0, -420],
      [2.0, 236],
      [TG_S, 236],
    ],
    [ARRIVE, "linear"],
  );
  const roll = tg(
    [
      [0, 0],
      [2.0, TRUCK_ROLL],
      [TG_S, TRUCK_ROLL],
    ],
    [ARRIVE, "linear"],
  );
  const settle = tg([
    [0, 0],
    [1.95, 0],
    [2.15, 1.6],
    [2.4, 0],
    [TG_S, 0],
  ]);
  const cab = tg([
    [0, 1],
    [2.1, 1],
    [2.3, 0.1],
    [2.65, 0.1],
    [2.9, 1],
    [TG_S, 1],
  ]);
  const WALK_FROM = 2.5;
  const WALK_TO = 4.1;
  const STEP = 0.29;
  const SET = 4.55;
  const x = tg(
    [
      [0, 322],
      [2.2, 322],
      [WALK_FROM, 344],
      [WALK_TO, 474],
      [TG_S, 474],
    ],
    ["linear", "easeOut", "linear", "linear"],
  );
  const shown = tg([
    [0, 0],
    [2.2, 0],
    [2.4, 1],
    [TG_S, 1],
  ]);
  const body = tg([[0, 0], ...swing(WALK_FROM, WALK_TO, STEP / 2, 0, -1.4), [WALK_TO, 0], [4.35, 5], [4.7, 5], [5.0, 0], [TG_S, 0]]);
  const lean = tg([
    [0, 0],
    [WALK_TO, 0],
    [4.35, 16],
    [4.7, 16],
    [5.0, 0],
    [TG_S, 0],
  ]);
  const legA = tg([[0, 0], ...swing(WALK_FROM, WALK_TO, STEP, -22, 22), [WALK_TO, 0], [TG_S, 0]]);
  const legB = tg([[0, 0], ...swing(WALK_FROM, WALK_TO, STEP, 22, -22), [WALK_TO, 0], [TG_S, 0]]);
  const armFront = tg([
    [0, -75],
    [SET, -75],
    [4.85, 0],
    [TG_S, 0],
  ]);
  const armWave = tg([[0, -75], [SET, -75], [4.85, 0], [5.15, -150], ...swing(5.25, 5.6, 0.18, -130, -160), [TG_S, -150]]);
  const carry = tg([
    [0, 1],
    [SET - 0.01, 1],
    [SET, 0],
    [TG_S, 0],
  ]);
  const face = tg([
    [0, 1],
    [4.95, 1],
    [5.1, -1],
    [TG_S, -1],
  ]);
  const door = tg([
    [0, 1],
    [4.9, 1],
    [5.2, 0.12],
    [TG_S, 0.12],
  ]);
  const stepX = tg([
    [0, 491],
    [5.15, 491],
    [5.5, 512],
    [TG_S, 512],
  ]);
  const stepShown = tg([
    [0, 0],
    [SET - 0.01, 0],
    [SET, 1],
    [5.2, 1],
    [5.5, 0],
    [TG_S, 0],
  ]);
  return (
    <g>
      {/* Warm afternoon sky, low sun, rolling hills */}
      <rect x="-2000" y="-2000" width="4600" height="2310" fill="#f5d7a1" />
      <circle cx="150" cy="150" r="34" fill="#f2a33a" />
      <ellipse cx="60" cy="300" rx="300" ry="90" fill="#e3a25a" />
      <ellipse cx="560" cy="306" rx="320" ry="70" fill="#c46a2b" />
      {/* Trees in their autumn colours */}
      <AutumnTree x={40} y={290} s={1.1} colors={["#d9622b", "#e9a23b"]} />
      <AutumnTree x={130} y={296} s={0.85} colors={["#b8452a", "#d9622b"]} />
      <AutumnTree x={318} y={292} s={0.95} colors={["#e9a23b", "#f2c14e"]} />
      <Farmhouse door={door} />
      {/* The box on the step, sliding in through the door */}
      <motion.g initial={false} animate={{ x: stepX.values, opacity: stepShown.values }} transition={{ x: stepX.t, opacity: stepShown.t }}>
        <g transform="translate(0 300)">
          <Present s={0.55} colors={AUTUMN_BOX} />
        </g>
      </motion.g>
      {/* Field, then the country road with a dashed centre line */}
      <rect x="-2000" y="302" width="4600" height="2000" fill="#b8913f" />
      <rect x="-2000" y="306" width="4600" height="22" fill="#6e5a48" />
      <line x1="-2000" y1="317" x2="2600" y2="317" stroke="#e8d6a8" strokeWidth="2" strokeDasharray="12 10" />
      <motion.g initial={false} animate={{ x: truckX.values, y: settle.values }} transition={{ x: truckX.t, y: settle.t }}>
        <g transform="translate(0 316)">
          <DeliveryTruck roll={roll} door={cab} snowy={false} />
        </g>
      </motion.g>
      <DriverFigure
        x={x}
        shown={shown}
        face={face}
        body={body}
        lean={lean}
        legA={legA}
        legB={legB}
        armFront={armFront}
        armWave={armWave}
        carry={carry}
        carried={<Present s={0.55} colors={AUTUMN_BOX} />}
      />
      <Leaves />
    </g>
  );
}

/** A chair back, behind someone seated at the table. */
function Chair({ x }: { x: number }) {
  return (
    <g>
      <rect x={x - 16} y="196" width="32" height="56" rx="6" fill="#7a4a2c" />
      <rect x={x - 11} y="204" width="22" height="6" rx="3" fill="#8f5a36" />
    </g>
  );
}

/** A candle with a flickering flame. */
function Candle({ x, i }: { x: number; i: number }) {
  return (
    <g>
      <rect x={x - 3.5} y="226" width="7" height="24" rx="2" fill="#f6e7c8" />
      <path className="cp-flicker" d={`M${x} 214q4 6 0 11q-4-5 0-11z`} fill={GOLD} style={vars({ t: 0.9 + i * 0.17, d: -i * 0.31 })} />
    </g>
  );
}

/** The roast turkey on its platter, centre at x. */
function Turkey({ x }: { x: number }) {
  return (
    <g>
      <ellipse cx={x} cy="249" rx="30" ry="6" fill="#e8e0d0" />
      <ellipse cx={x} cy="236" rx="22" ry="14" fill="#b0662c" />
      <ellipse cx={x - 2} cy="231" rx="13" ry="6" fill="#c97a3a" />
      <path d={`M${x - 20} 240q-10 2-12-6`} stroke="#9a5424" strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d={`M${x + 20} 240q10 2 12-6`} stroke="#9a5424" strokeWidth="6" fill="none" strokeLinecap="round" />
      <circle cx={x - 32} cy="233" r="3.2" fill="#f6e7c8" />
      <circle cx={x + 32} cy="233" r="3.2" fill="#f6e7c8" />
    </g>
  );
}

/**
 * The 3D printer on its stand, printing the pumpkin centrepiece: the
 * nozzle sweeps across while the print grows a layer at a time.
 */
function Printer({ layers, nozzle, bedPrint }: { layers: Anim; nozzle: Anim; bedPrint: Anim }) {
  // The print is revealed from the bed up: the clip box grows a layer at a time.
  const clipY = { values: layers.values.map((h) => 223 - h), t: layers.t };
  const clipH = { values: layers.values.map((h) => h + 1), t: layers.t };
  // The nozzle tip stays just above the top of the print.
  const headY = { values: layers.values.map((h) => 216 - h), t: layers.t };
  return (
    <g>
      {/* Stand */}
      <rect x="72" y="236" width="84" height="6" rx="2" fill="#7a4a2c" />
      <rect x="78" y="242" width="6" height="50" fill="#5b3a2c" />
      <rect x="144" y="242" width="6" height="50" fill="#5b3a2c" />
      {/* Frame */}
      <rect x="80" y="226" width="68" height="10" rx="2" fill="#2a3540" />
      <rect x="82" y="160" width="6" height="68" fill="#3d4a57" />
      <rect x="140" y="160" width="6" height="68" fill="#3d4a57" />
      <rect x="82" y="156" width="64" height="7" rx="2" fill="#2a3540" />
      <rect x="88" y="222" width="52" height="4" fill="#9fb0c0" />
      {/* The print: a little pumpkin, layer by layer */}
      <defs>
        <clipPath id="tg-print">
          <motion.rect x="80" width="70" initial={false} animate={{ y: clipY.values, height: clipH.values }} transition={{ y: clipY.t, height: clipH.t }} />
        </clipPath>
      </defs>
      <motion.g initial={false} animate={{ opacity: bedPrint.values }} transition={{ opacity: bedPrint.t }}>
        <g clipPath="url(#tg-print)">
          <g transform="translate(114 222)">
            <Pumpkin s={1.25} />
          </g>
        </g>
      </motion.g>
      {/* Gantry and nozzle, riding up as the print grows and sweeping across each layer */}
      <motion.g initial={false} animate={{ y: headY.values }} transition={{ y: headY.t }}>
        <g transform="translate(0 0)">
          <rect x="88" y="-4" width="52" height="4" fill="#5b6b7a" transform="translate(0 0)" />
          <motion.g initial={false} animate={{ x: nozzle.values }} transition={{ x: nozzle.t }}>
            <rect x="-7" y="-10" width="14" height="10" rx="2" fill="#e9a23b" />
            <path d="M-3 0h6l-3 5z" fill="#2a3540" />
          </motion.g>
        </g>
      </motion.g>
    </g>
  );
}

/** Act two: Thanksgiving dinner. */
function DiningRoom() {
  // The printer prints from 6.5 to 9.5 s: 12 layers, the nozzle sweeping across each one.
  const PRINT_FROM = 6.5;
  const PRINT_TO = 9.5;
  const LAYERS = 12;
  const PRINT_H = 28;
  const layerPts: [number, number][] = [[0, 0]];
  for (let k = 0; k <= LAYERS; k++) layerPts.push([PRINT_FROM + ((PRINT_TO - PRINT_FROM) * k) / LAYERS, (PRINT_H * k) / LAYERS]);
  layerPts.push([TG_S, PRINT_H]);
  const layers = tg(layerPts, "linear");
  const nozzle = tg([[0, 114], [PRINT_FROM, 114], ...swing(PRINT_FROM, PRINT_TO, (PRINT_TO - PRINT_FROM) / LAYERS / 2, 96, 132), [PRINT_TO, 114], [TG_S, 114]], "easeInOut");
  // Once Dad lifts it, the copy on the bed goes and the carried one takes over.
  const PICK = 10.0;
  const bedPrint = tg([
    [0, 1],
    [PICK - 0.01, 1],
    [PICK, 0],
    [TG_S, 0],
  ]);

  // Dad: watching the printer, picks the pumpkin up, carries it to the table, sets it down, sits.
  const DAD_START = 168;
  const SET_AT = 342;
  const DAD_SEAT = 398;
  const dadX = tg(
    [
      [0, DAD_START],
      [10.3, DAD_START],
      [11.6, SET_AT],
      [12.25, SET_AT],
      [12.7, DAD_SEAT],
      [TG_S, DAD_SEAT],
    ],
    ["linear", "linear", "linear", "linear", "linear"],
  );
  const dadRise = tg([
    [0, 1],
    [12.75, 1],
    [13.15, 0],
    [TG_S, 0],
  ]);
  const step = 0.28;
  const walk = (a: number, b: number): [number, number][] => [...swing(10.3, 11.6, step, a, b), [11.6, 0], [12.25, 0], ...swing(12.25, 12.7, step, a, b), [12.7, 0]];
  const dadLegL = tg([[0, 0], ...walk(-18, 18), [TG_S, 0]]);
  const dadLegR = tg([[0, 0], ...walk(18, -18), [TG_S, 0]]);
  const dadLean = tg([
    [0, 0],
    [9.6, 0],
    [9.85, -18],
    [10.1, -18],
    [10.3, 0],
    [11.6, 0],
    [11.85, 12],
    [12.05, 12],
    [12.25, 0],
    [TG_S, 0],
  ]);
  // Reaches over to the printer, lifts the pumpkin up over his head, then lowers it onto the table.
  const dadArmL = tg([
    [0, -12],
    [9.6, -12],
    [9.85, 30],
    [10.1, 30],
    [10.4, 172],
    [11.6, 172],
    [11.9, -40],
    [12.15, -12],
    [TG_S, -12],
  ]);
  // Everyone raises a glass together.
  const toastR = (from: number): [number, number][] => [
    [from, 12],
    [16.1, 12],
    [16.5, -145],
    [16.75, -135],
    [17.0, -145],
    [TG_S, -145],
  ];
  const dadArmR = tg([[0, 12], [9.6, 12], [9.85, 30], [10.1, 30], [10.4, -172], [11.6, -172], [11.9, 40], ...toastR(12.15)]);
  const dadGlass = tg([
    [0, 0],
    [13.2, 0],
    [13.4, 1],
    [TG_S, 1],
  ]);
  // The pumpkin: on the bed, then in Dad's hands, then on the table.
  const pumpX = tg(
    [
      [0, 114],
      [9.85, 114],
      [10.1, DAD_START],
      [10.3, DAD_START],
      [11.6, SET_AT],
      [11.95, SET_AT + 10],
      [TG_S, SET_AT + 10],
    ],
    ["linear", "easeInOut", "linear", "linear", "easeOut", "linear"],
  );
  const pumpY = tg([
    [0, 222],
    [9.85, 222],
    [10.1, 214],
    [10.4, 178],
    [11.6, 178],
    [11.95, 250],
    [TG_S, 250],
  ]);
  const pumpShown = tg([
    [0, 0],
    [PICK - 0.01, 0],
    [PICK, 1],
    [TG_S, 1],
  ]);

  // Mom cheers when the centrepiece lands, and toasts with everyone.
  const momArmL = tg([[0, -12], [12.0, -12], ...swing(12.1, 12.9, 0.16, -48, -22), [13.0, -12], [TG_S, -12]]);
  const momArmR = tg([[0, 12], [12.0, 12], ...swing(12.1, 12.9, 0.16, 48, 22), ...toastR(13.0)]);
  // The kid reaches for the box, lifts the lid, and holds the gift card up high.
  const KID_X = 266;
  // The box sits just to the kid's right, so the kid (on a booster seat) stays in view.
  const BOX_X = 298;
  const BOOST = -16;
  const kidArmL = tg([[0, -12], [13.3, -12], [13.6, -30], [14.0, -30], [14.6, 172], ...swing(14.8, 15.4, 0.3, 166, 178), [15.6, 166], [15.95, -12], [TG_S, -12]]);
  const kidArmR = tg([[0, 12], [13.3, 12], [13.6, 30], [14.0, 30], [14.6, -172], ...swing(14.8, 15.4, 0.3, -166, -178), [15.6, -166], ...toastR(15.95)]);
  const kidHop = tg([
    [0, BOOST],
    [14.7, BOOST],
    [14.9, BOOST - 7],
    [15.15, BOOST],
    [TG_S, BOOST],
  ]);
  const lid = tg([
    [0, 0],
    [13.8, 0],
    [14.2, 1],
    [TG_S, 1],
  ]);
  const cardY = tg([
    [0, 240],
    [14.0, 240],
    [14.6, 184],
    [14.9, 177],
    [15.15, 184],
    [15.6, 184],
    [15.95, 240],
    [TG_S, 240],
  ]);
  const cardX = tg([
    [0, BOX_X],
    [14.0, BOX_X],
    [14.6, KID_X],
    [15.6, KID_X],
    [15.95, BOX_X],
    [TG_S, BOX_X],
  ]);
  const cardShown = tg([
    [0, 0],
    [13.95, 0],
    [14.1, 1],
    [15.8, 1],
    [15.95, 0],
    [TG_S, 0],
  ]);
  const momGlass = hold(1);
  const kidGlass = tg([
    [0, 0],
    [15.95, 0],
    [16.1, 1],
    [TG_S, 1],
  ]);
  const sparkle = (at: number) =>
    tg([
      [0, 0],
      [at, 0],
      [at + 0.25, 1],
      [at + 0.7, 0],
      [TG_S, 0],
    ]);
  const sparkles: [number, number, number][] = [
    [100, 196, 9.55],
    [130, 186, 9.7],
    [330, 226, 12.0],
    [366, 222, 12.15],
    [244, 168, 14.7],
    [290, 164, 14.85],
    [250, 150, 16.7],
    [340, 156, 16.85],
  ];
  return (
    <g>
      {/* Warm walls, wainscoting, wood floor */}
      <rect x="-2000" y="-2000" width="4600" height="2292" fill="#5a3326" />
      <rect x="-2000" y="230" width="4600" height="62" fill="#47281e" />
      <rect x="-2000" y="228" width="4600" height="4" fill="#6b3d2d" />
      <rect x="-2000" y="292" width="4600" height="2000" fill="#7a5236" />
      {/* Window: autumn outside, leaves blowing past */}
      <defs>
        <clipPath id="tg-window">
          <rect x="474" y="80" width="70" height="100" rx="4" />
        </clipPath>
      </defs>
      <rect x="468" y="74" width="82" height="112" rx="6" fill="#e8dcc8" />
      <g clipPath="url(#tg-window)">
        <rect x="474" y="80" width="70" height="100" fill="#f5d7a1" />
        <ellipse cx="510" cy="186" rx="60" ry="24" fill="#c46a2b" />
        <AutumnTree x={496} y={176} s={0.7} colors={["#d9622b", "#e9a23b"]} />
        <Leaves x={420} y={20} w={140} h={200} count={14} seed={4} wind={80} size={0.8} />
      </g>
      <rect x="507" y="80" width="4" height="100" fill="#e8dcc8" />
      {/* A garland of leaves along the top of the wall */}
      <path d="M150 120q85 26 170 0t170 0" stroke="#7a3b1d" strokeWidth="1.5" fill="none" />
      {[170, 205, 240, 275, 310, 345, 380, 415, 450].map((lx, i) => (
        <path key={lx} d={LEAF} transform={`translate(${lx} ${128 + Math.sin(((lx - 150) / 340) * Math.PI * 2) * -6}) scale(1.3)`} fill={LEAVES[i % LEAVES.length]} />
      ))}
      <Printer layers={layers} nozzle={nozzle} bedPrint={bedPrint} />
      {/* Dad sits in front of his own chair but walks behind the others: his chair first, theirs after him */}
      <Chair x={DAD_SEAT} />
      <Member x={dadX} {...DAD} rise={dadRise} lean={dadLean} legL={dadLegL} legR={dadLegR} armL={dadArmL} armR={dadArmR} glass={dadGlass} />
      <Chair x={214} />
      <Chair x={KID_X} />
      <rect x={KID_X - 14} y="236" width="28" height="16" rx="4" fill="#4a6b2a" />
      <Member x={hold(214)} {...MOM} armL={momArmL} armR={momArmR} glass={momGlass} />
      <Member x={hold(KID_X)} scale={KID_SCALE} {...KID} hop={kidHop} armL={kidArmL} armR={kidArmR} glass={kidGlass} />
      {/* The gift card, rising out of the box and held up high */}
      <motion.g initial={false} animate={{ x: cardX.values, y: cardY.values, opacity: cardShown.values }} transition={{ x: cardX.t, y: cardY.t, opacity: cardShown.t }}>
        <g>
          <rect x="-15" y="-10" width="30" height="20" rx="3" fill="#0e4471" />
          <path d="M-10 -1c2.5-2 5-2 7.5 0s5 2 7.5 0" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <circle cx="9" cy="-5" r="2.2" fill={GOLD} />
          <text x="12" y="7.5" textAnchor="end" fontSize="5.5" fontWeight="700" fill={GOLD} fontFamily="var(--font-geist-sans)">
            $50
          </text>
        </g>
      </motion.g>
      {/* The table: cloth with a runner, and dinner on top */}
      <rect x="160" y="248" width="300" height="6" rx="2" fill="#efe2c4" />
      <rect x="164" y="254" width="292" height="44" fill="#e6d5b0" />
      <rect x="164" y="254" width="292" height="7" fill="#c46a2b" />
      <Turkey x={300} />
      <ellipse cx="196" cy="249" rx="14" ry="4" fill="#e8e0d0" />
      <path d="M184 246q12 -14 24 0z" fill="#c98a3a" />
      <ellipse cx="438" cy="248" rx="13" ry="5" fill="#4a6b2a" />
      <Candle x={244} i={0} />
      <Candle x={374} i={1} />
      {/* The delivered box in front of the kid */}
      <RoomPresent x={hold(BOX_X)} y={hold(250)} lid={lid} colors={AUTUMN_BOX} />
      {/* The printed pumpkin, carried and then set among the food */}
      <motion.g initial={false} animate={{ x: pumpX.values, y: pumpY.values, opacity: pumpShown.values }} transition={{ x: pumpX.t, y: pumpY.t, opacity: pumpShown.t }}>
        <Pumpkin s={1.25} />
      </motion.g>
      {sparkles.map(([sx, sy, at], i) => {
        const a = sparkle(at);
        return <motion.path key={i} d={`M${sx} ${sy - 7}v14M${sx - 7} ${sy}h14`} stroke={GOLD_DARK} strokeWidth="2.6" strokeLinecap="round" initial={false} animate={{ opacity: a.values }} transition={{ opacity: a.t }} />;
      })}
    </g>
  );
}

/** A tall (9:16) window on the scene, centred on (cx, cy), `w` units wide. */
const shot = (cx: number, w: number, cy: number) => {
  const h = (w * 16) / 9;
  return `${(cx - w / 2).toFixed(1)} ${(cy - h / 2).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`;
};

/**
 * The dinner camera on tall screens: close on the printer while it prints,
 * pans with Dad as he carries the pumpkin over, then frames the family.
 */
const ROOM_CAMERA = tg([
  [0, shot(128, 190, 214)],
  [9.9, shot(128, 190, 214)],
  [11.7, shot(300, 300, 218)],
  [12.4, shot(318, 250, 214)],
  [16.0, shot(318, 250, 214)],
  [16.6, shot(306, 290, 214)],
  [TG_S, shot(306, 290, 214)],
]);

/**
 * The whole Thanksgiving story (TG_S seconds): the road, then dinner,
 * cross-fading at ROOM_AT. Two stacked layers, so on tall screens each act
 * frames its own middle (the truck and the door; the printer and the table).
 */
export function ThanksgivingStory({ tall = false }: { tall?: boolean }) {
  const road = tg([
    [0, 1],
    [ROOM_AT, 1],
    [ROOM_AT + 0.7, 0],
    [TG_S, 0],
  ]);
  const svg = "absolute inset-0 h-full w-full overflow-visible";
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      {tall ? (
        <motion.svg viewBox={ROOM_CAMERA.values[0]} initial={false} animate={{ viewBox: ROOM_CAMERA.values }} transition={{ viewBox: ROOM_CAMERA.t }} preserveAspectRatio="xMidYMid meet" className={svg}>
          <AutumnStyles />
          <DiningRoom />
        </motion.svg>
      ) : (
        <svg viewBox="0 0 600 360" preserveAspectRatio="xMidYMid meet" className={svg}>
          <AutumnStyles />
          <DiningRoom />
        </svg>
      )}
      <motion.div className="absolute inset-0" initial={false} animate={{ opacity: road.values }} transition={{ opacity: road.t }}>
        <svg viewBox={tall ? "196 60 394 300" : "0 0 600 360"} preserveAspectRatio="xMidYMid meet" className={svg}>
          <AutumnStyles />
          <CountryRoad />
        </svg>
      </motion.div>
    </div>
  );
}
