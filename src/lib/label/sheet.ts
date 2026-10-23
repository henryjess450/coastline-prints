import { labels } from "@config/labels";

type Sheet = typeof labels.sheet;

/** Spots per sheet (4 on Avery 8168), numbered 1.. left to right, top to bottom. */
export const spotsPerSheet = (s: Sheet = labels.sheet) => s.columns * s.rows;

/**
 * Where spot n (1-based) sits, in PDF points from the page's bottom-left
 * corner, with the printer nudge applied.
 */
export function spotRect(n: number, s: Sheet = labels.sheet, nudge: { x: number; y: number } = labels.nudgeIn) {
  const i = n - 1;
  const col = i % s.columns;
  const row = Math.floor(i / s.columns);
  const leftIn = s.marginIn[0] + col * s.pitchIn[0] + nudge.x;
  const topIn = s.marginIn[1] + row * s.pitchIn[1] + nudge.y;
  return {
    x: leftIn * 72,
    y: (s.pageIn[1] - topIn - s.labelIn[1]) * 72,
    width: s.labelIn[0] * 72,
    height: s.labelIn[1] * 72,
  };
}

/**
 * Lays out `count` labels starting at spot `start`, filling the free spots on
 * the first sheet and carrying on to fresh sheets. `skip` lists spots on the
 * first sheet that are already used. Returns the page and spot for each label.
 */
export function placeLabels(count: number, start: number, skip: number[] = [], s: Sheet = labels.sheet) {
  const per = spotsPerSheet(s);
  const out: { page: number; spot: number }[] = [];
  let page = 0;
  let spot = Math.min(Math.max(1, Math.floor(start)), per);
  while (out.length < count) {
    if (spot > per) {
      page++;
      spot = 1;
    }
    if (!(page === 0 && skip.includes(spot))) out.push({ page, spot });
    spot++;
  }
  return out;
}
