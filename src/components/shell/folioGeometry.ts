import * as THREE from "three";

// Folio's shape and colours, from the character sheet. Shared by the corner mascot (FolioScene) and the
// Playground island's walking Folio (IslandFolio), so both are the same character.

export const PAPER = "#f4efe3";
export const FOLD = "#2457f5";
export const CREASE = "#cfcbc0";
export const FACE = "#111111";
export const LIMB_ON_LIGHT = "#141414";
export const LIMB_ON_DARK = "#4a4a4c";

export const W = 1; // half width
export const H = 1.25; // half height
const CUT: [number, number][] = [
  [1 * W, 0.45],
  [0.2, H],
];
export const DEPTH = 0.24;
export const BEVEL = 0.05;
export const FRONT = DEPTH / 2 + BEVEL;
export const ARM_LEN = 0.5;

/** The page: rounded corners with the top-right corner cut away for the fold. */
export function pageShape() {
  const r = 0.2;
  const s = new THREE.Shape();
  s.moveTo(-W + r, -H);
  s.lineTo(W - r, -H);
  s.quadraticCurveTo(W, -H, W, -H + r);
  s.lineTo(...CUT[0]);
  s.lineTo(...CUT[1]);
  s.lineTo(-W + r, H);
  s.quadraticCurveTo(-W, H, -W, H - r);
  s.lineTo(-W, -H + r);
  s.quadraticCurveTo(-W, -H, -W + r, -H);
  return s;
}

export function polygon(points: [number, number][]) {
  const s = new THREE.Shape();
  points.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  s.closePath();
  return s;
}

export function extrude(shape: THREE.Shape, depth = DEPTH, bevel = BEVEL) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 6,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** Folio's solid parts. Joints: arms hang from (±(W + 0.02), -0.28), legs from (±0.42, -H); the face sits at FRONT. */
export function folioGeometries() {
  return {
    page: extrude(pageShape()),
    fold: extrude(
      polygon([
        [0.2, H],
        [0.6, H + 0.02],
        [W + 0.04, 0.8],
        [W, 0.45],
      ]),
      DEPTH,
      BEVEL,
    ),
    crease: new THREE.ShapeGeometry(
      polygon([
        [0.56, 0.89],
        [W, 0.45],
        [W, 0.06],
      ]),
    ),
    arm: new THREE.CapsuleGeometry(0.12, ARM_LEN, 4, 12).translate(0, -ARM_LEN / 2 - 0.05, 0),
    hand: new THREE.SphereGeometry(0.17, 16, 12).translate(0, -ARM_LEN - 0.14, 0),
    leg: new THREE.CapsuleGeometry(0.15, 0.32, 4, 12).translate(0, -0.2, 0),
    foot: new THREE.SphereGeometry(0.2, 16, 12).scale(1.35, 0.72, 1.1).translate(0, -0.48, 0.05),
    eye: new THREE.CapsuleGeometry(0.065, 0.18, 4, 10),
    smile: new THREE.TorusGeometry(0.1, 0.021, 6, 16, Math.PI),
  };
}
