// Vaini as a pixel sprite, from refs/vaiini5 (front): a cream sheet of paper, torn top with
// four soft teeth on the left two thirds, lime corner folded forward, two lime text lines,
// tall black oval eyes low on the face, chunky arms out and down, two stubby legs.
import { px, rect, stroke, disc, ellipse } from "./raster.js";

const C = {
  cream: "#f5eede", creamHi: "#fffaf0", creamShade: "#e2d6bb", outline: "#b8a784",
  lime: "#a6d62a", limeHi: "#c6ec52", limeShade: "#6e9e1c", eye: "#141414", eyeHi: "#ffffff",
};

const BW = 30; // body width
const BH = 29; // body height (bottom row = BH-1)

// Top profile: y offset of the top edge for each column.
function topAt(c) {
  if (c >= 20) return c - 20;               // diagonal cut of the folded corner
  const k = c % 5;                          // four soft teeth, 5 px each
  return [2, 1, 0, 1, 2][k];
}

function insideBody(c, r) {
  if (c < 0 || c >= BW || r < 0 || r >= BH) return false;
  if (r < topAt(c)) return false;
  if (c >= 20 && r < 9 && r < c - 20) return false;
  // rounded bottom corners
  if (r === BH - 1 && (c === 0 || c === BW - 1)) return false;
  return true;
}

/**
 * pose: { blink, lookX (-1..1), bob (px), armL angle, armR angle (rad from straight down, + = outwards),
 *         racket: true, swing (0..1 visual squash), squash }
 */
export function drawVaini(cv, x, y, pose) {
  const bx = Math.round(x - BW / 2);
  const by = Math.round(y - BH - (pose.legH ?? 6) + (pose.bob || 0)); // y = feet line (or seat line when sitting)

  // Ground shadow
  if (pose.shadow !== false) ellipse(cv, x, y + 1, 17, 3, pose.shadow ?? "#1c5a9e", 0.35);

  // Legs (stubby, shaded). legH shortens them when sitting; walk lifts them alternately.
  const legH = pose.legH ?? 6;
  const lift = pose.walk === undefined ? [0, 0] : [Math.max(0, Math.round(Math.sin(pose.walk) * 2)), Math.max(0, Math.round(-Math.sin(pose.walk) * 2))];
  [6, 18].forEach((lx, k) => {
    const ly = by + BH - 1 - lift[k];
    rect(cv, bx + lx, ly, 7, legH + 1, C.outline);
    rect(cv, bx + lx + 1, ly, 5, legH, C.cream);
    rect(cv, bx + lx + 4, ly, 1, legH, C.creamShade);
  });

  // Arms behind the body edge: capsules from the side notches
  const armY = by + 17;
  const armLen = 9;
  const drawArm = (side, ang) => {
    const sx = side < 0 ? bx + 1 : bx + BW - 2;
    const ex = sx + side * Math.sin(ang) * armLen;
    const ey = armY + Math.cos(ang) * armLen;
    stroke(cv, sx, armY, ex, ey, 3.9, C.outline);
    stroke(cv, sx, armY, ex, ey, 2.9, C.cream);
    stroke(cv, sx + side * 0.6, armY + 1, ex + side * 0.6, ey + 0.6, 1.2, C.creamShade);
    return [ex, ey];
  };
  const handL = drawArm(-1, pose.armL);
  const handR = drawArm(1, pose.armR);

  // Body with outline + light from top-left
  for (let r = -1; r <= BH; r++)
    for (let c = -1; c <= BW; c++) {
      if (insideBody(c, r)) continue;
      if (insideBody(c - 1, r) || insideBody(c + 1, r) || insideBody(c, r - 1) || insideBody(c, r + 1)) px(cv, bx + c, by + r, C.outline);
    }
  for (let r = 0; r < BH; r++)
    for (let c = 0; c < BW; c++) {
      if (!insideBody(c, r)) continue;
      let col = C.cream;
      if (c >= BW - 3 || r >= BH - 3) col = C.creamShade;
      else if (r <= topAt(c) + 1 && c < 20) col = C.creamHi;
      px(cv, bx + c, by + r, col);
    }

  // Folded corner: lit lime flap over the cut, darker curl underneath
  for (let r = 0; r < 12; r++)
    for (let c = 19; c < BW; c++) {
      const onFlap = c >= 20 && r >= c - 20 && r <= 8 + (c - 20) / 9;
      if (onFlap) px(cv, bx + c, by + r, r === c - 20 ? C.limeHi : C.lime);
      const onShade = c >= 24 && r >= 9 && r <= 9 + (c - 24) && c <= BW - 1;
      if (onShade) px(cv, bx + c, by + r, C.limeShade);
    }
  for (let r = 0; r <= 8; r++) px(cv, bx + 20, by + r, C.limeShade); // flap edge

  // Two text lines (rounded ends)
  const line = (c0, len, r0) => {
    rect(cv, bx + c0 + 1, by + r0, len - 2, 3, C.lime);
    rect(cv, bx + c0, by + r0 + 1, 1, 1, C.lime);
    rect(cv, bx + c0 + len - 1, by + r0 + 1, 1, 1, C.lime);
    rect(cv, bx + c0 + 1, by + r0 + 2, len - 2, 1, C.limeShade);
  };
  line(4, 13, 6);
  line(4, 9, 11);

  // Eyes: tall ovals, look toward the ball, blink
  const lx = Math.round(pose.lookX || 0);
  for (const ex of [7, 18]) {
    const cx = bx + ex + lx;
    if (pose.blink) {
      rect(cv, cx, by + 19, 4, 1, C.eye);
    } else {
      rect(cv, cx, by + 16, 4, 7, C.eye);
      px(cv, cx, by + 16, C.cream); px(cv, cx + 3, by + 16, C.cream);
      px(cv, cx, by + 22, C.cream); px(cv, cx + 3, by + 22, C.cream);
      px(cv, cx + 1, by + 17, C.eyeHi, 0.95);
    }
  }

  // Blush when happy (after a good hit)
  if (pose.blush) {
    rect(cv, bx + 5, by + 23, 3, 1, "#ff9d8a", pose.blush * 0.8);
    rect(cv, bx + 23, by + 23, 3, 1, "#ff9d8a", pose.blush * 0.8);
  }

  return { handL, handR, bx, by };
}

/** Padel racket: carbon face with holes, orange rim, handle in the hand. ang: 0 = pointing up. */
export function drawRacket(cv, hx, hy, ang, glint = 0) {
  const ux = Math.sin(ang), uy = -Math.cos(ang);
  const neckX = hx + ux * 5, neckY = hy + uy * 5;
  stroke(cv, hx, hy, neckX, neckY, 1.2, "#3a2f2a");
  const cx = hx + ux * 11, cy = hy + uy * 11;
  // oval head: sample points in local frame
  for (let y = Math.floor(cy - 9); y <= Math.ceil(cy + 9); y++)
    for (let x = Math.floor(cx - 9); x <= Math.ceil(cx + 9); x++) {
      const dx = x - cx, dy = y - cy;
      const a = dx * ux + dy * uy;        // along handle
      const b = dx * -uy + dy * ux;       // across
      const e = (a / 7.2) ** 2 + (b / 5.6) ** 2;
      if (e > 1) continue;
      if (e > 0.72) px(cv, x, y, "#ff7a2f");
      else {
        const hole = (Math.round(a) % 3 === 0) && (Math.round(b) % 3 === 0);
        px(cv, x, y, hole ? "#4a5060" : "#23262e");
      }
    }
  if (glint > 0) {
    disc(cv, cx - uy * 3, cy + ux * 3, 1.5, "#ffffff", glint);
    stroke(cv, cx - 7, cy - 7, cx + 7, cy + 7, 0.6, "#fffbe0", glint * 0.8);
    stroke(cv, cx - 7, cy + 7, cx + 7, cy - 7, 0.6, "#fffbe0", glint * 0.8);
  }
}
