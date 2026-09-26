/**
 * اختيار العنصر التالي بالأسهم هندسياً (مستقل عن DOM ليُختبر).
 * نفضّل العنصر الأقرب في الاتجاه والمحاذي له على المحور الآخر؛ لذلك النزول في شبكة يبقى في نفس العمود.
 */

export type Direction = "up" | "down" | "left" | "right";

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const EPS = 1;

/** المسافة بين مجالين على محور واحد (0 إن تداخلا). */
function gap(a1: number, a2: number, b1: number, b2: number) {
  if (b2 < a1) return a1 - b2;
  if (b1 > a2) return b1 - a2;
  return 0;
}

export function score(from: Box, to: Box, dir: Direction): number | null {
  let primary: number;
  let ortho: number;
  let centerOffset: number;
  const fcx = (from.left + from.right) / 2;
  const fcy = (from.top + from.bottom) / 2;
  const tcx = (to.left + to.right) / 2;
  const tcy = (to.top + to.bottom) / 2;

  switch (dir) {
    case "right":
      if (to.left < from.right - EPS) return null;
      primary = to.left - from.right;
      ortho = gap(from.top, from.bottom, to.top, to.bottom);
      centerOffset = Math.abs(tcy - fcy);
      break;
    case "left":
      if (to.right > from.left + EPS) return null;
      primary = from.left - to.right;
      ortho = gap(from.top, from.bottom, to.top, to.bottom);
      centerOffset = Math.abs(tcy - fcy);
      break;
    case "down":
      if (to.top < from.bottom - EPS) return null;
      primary = to.top - from.bottom;
      ortho = gap(from.left, from.right, to.left, to.right);
      centerOffset = Math.abs(tcx - fcx);
      break;
    case "up":
      if (to.bottom > from.top + EPS) return null;
      primary = from.top - to.bottom;
      ortho = gap(from.left, from.right, to.left, to.right);
      centerOffset = Math.abs(tcx - fcx);
      break;
  }
  return Math.max(0, primary) + ortho * 3 + centerOffset * 0.01;
}

/** فهرس أفضل مرشح، أو -1 إن لم يوجد شيء في هذا الاتجاه. */
export function pickNext(from: Box, candidates: Box[], dir: Direction): number {
  let best = -1;
  let bestScore = Infinity;
  candidates.forEach((c, i) => {
    const s = score(from, c, dir);
    if (s !== null && s < bestScore) {
      bestScore = s;
      best = i;
    }
  });
  return best;
}
