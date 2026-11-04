/**
 * LightLab's lamps as fine line drawings, traced from the owner's own
 * outlines. Shared by the hero animation and the printed receipts.
 */
export type LampId = "mushroom" | "banana" | "cloud";

/** A line the pen draws, or a dot it taps (the cloud's eyes). */
export type Stroke = { d: string } | { dot: [number, number, number] };
export type Lamp = { id: LampId; name: string; strokes: Stroke[]; /** The drawing's bounds in its own units. */ box: [number, number, number, number] };

/** An ellipse as a path, starting and ending on its left edge. */
const ellipse = ([cx, cy, rx, ry]: number[]) => `M${cx - rx} ${cy} a${rx} ${ry} 0 1 0 ${2 * rx} 0 a${rx} ${ry} 0 1 0 ${-2 * rx} 0`;

// Mushroom spots, in the order the pen visits them (top to bottom, sweeping across).
const SPOTS = [[85, 57, 5, 8], [110, 55, 6, 8], [96, 78, 7, 7], [68, 88, 7, 10], [122, 82, 7, 10], [103, 110, 12, 12], [55, 120, 12, 12], [138, 118, 12, 14], [32, 148, 8, 6], [92, 140, 10, 10], [118, 147, 10, 10], [65, 155, 10, 10], [170, 140, 9, 6], [155, 155, 11, 10], [195, 152, 8, 5], [98, 168, 10, 10], [40, 177, 9, 9], [12, 187, 10, 8], [130, 173, 10, 10], [67, 187, 13, 9], [182, 170, 10, 10], [214, 175, 7, 5], [6, 209, 4, 3], [33, 205, 12, 7], [105, 198, 12, 8], [160, 190, 10, 10], [213, 190, 6, 5], [77, 213, 12, 8], [138, 205, 9, 9], [55, 220, 6, 4], [190, 200, 8, 6], [178, 208, 6, 4], [118, 220, 9, 6]];

export const LAMPS: Lamp[] = [
  {
    id: "mushroom",
    name: "Fun-gi",
    box: [-50, 22, 300, 394],
    strokes: [
      { d: "M-35 220 C-48 200 -40 170 -10 150 C20 130 40 115 48 90 C58 55 75 28 100 27 C125 28 140 50 150 85 C158 112 180 130 210 148 C238 166 248 192 240 212 C236 222 230 226 222 228 C160 244 30 242 -35 220 Z" },
      ...SPOTS.map((s) => ({ d: ellipse(s) })),
      { d: "M80 244 C70 292 40 322 40 362 C40 394 66 412 100 412 C134 412 170 394 170 362 C170 322 142 292 134 244" },
    ],
  },
  {
    id: "banana",
    name: "Banana After Dark",
    box: [0, 6, 284, 274],
    strokes: [
      // Bulb, the peel arching down to the table and back, the fruit, the flap: one line.
      { d: "M80 67 C78 40 92 12 118 10 C142 8 160 28 156 50 C154 62 146 74 140 84 C136 92 134 100 133 118 C140 100 152 88 172 82 C196 76 216 90 222 120 C228 160 228 200 238 225 C248 245 266 252 278 262 C282 268 274 272 266 272 C252 262 236 240 226 215 C214 180 214 140 206 120 C198 104 178 100 162 112 C152 122 152 140 150 150 C146 175 140 195 133 205 C118 232 100 250 60 258 C40 262 20 262 6 260 C0 256 2 248 10 240 C18 228 26 214 32 200 L43 184 C55 185 66 186 75 184 C74 160 76 120 82 100 C88 84 94 70 100 62 C88 64 82 70 76 70 C64 66 56 58 44 60 C26 70 18 110 20 140 C21 152 22 158 24 163 L32 200" },
      { d: "M8 264 C12 274 44 278 80 272 C108 266 124 248 134 222" },
      { d: "M113 227 C96 250 60 262 14 266" },
      // The filament
      { d: "M104 57 L103 42 L110 50 L116 44 L121 50 L127 44 L127 55" },
    ],
  },
  {
    id: "cloud",
    name: "Cloudy",
    box: [14, 10, 220, 140],
    strokes: [
      { d: "M62 148 C30 148 16 125 17 100 C18 70 40 44 70 41 C80 22 104 12 125 12 C146 12 162 22 172 34 C202 36 224 56 220 90 C232 100 234 118 230 128 C226 142 216 148 200 148 Z" },
      { d: "M60 135 C42 135 31 120 31 100 C31 76 52 56 76 53 C86 34 104 23 125 23 C143 23 158 33 165 47 C190 46 212 64 206 95 C216 102 222 112 220 122 C218 130 212 135 204 135 Z" },
      { dot: [97, 80, 5.5] },
      { dot: [156, 80, 5.5] },
      { d: "M118 98 C118 110 136 110 136 98" },
    ],
  },
];
