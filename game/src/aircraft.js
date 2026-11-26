// Sculpted 3D SC-7 Solara Corsair PBR mesh generator (static airframe + animated surfaces/props).

import { pushVertexQuad, pushVertexTri } from './math3d.js';

const RGBA_IVORY = [0.95, 0.94, 0.90, 1];
const RGBA_CRIMSON = [0.85, 0.22, 0.18, 1];
const RGBA_SLATE = [0.16, 0.21, 0.28, 1];
const RGBA_CANOPY = [0.28, 0.62, 0.82, 0.82];
const RGBA_CHROME = [0.82, 0.86, 0.90, 1];
const RGBA_TIRE = [0.09, 0.10, 0.12, 1];
const RGBA_NAV_RED = [1.0, 0.18, 0.14, 1];
const RGBA_NAV_GREEN = [0.16, 0.95, 0.42, 1];
const RGBA_NAV_WHITE = [1.0, 0.98, 0.92, 1];
const RGBA_EXHAUST = [1.0, 0.56, 0.18, 0.9];
const RGBA_PROP_DISC = [0.82, 0.90, 0.98, 0.24];

const MAT_PAINT = [0.32, 0.22, 0.0];
const MAT_METAL = [0.22, 0.78, 0.0];
const MAT_GLASS = [0.08, 0.38, 0.08];
const MAT_MATTE = [0.85, 0.05, 0.0];
const MAT_EMISSIVE = [0.2, 0.0, 1.45];

/** Loft an elliptical fuselage/nacelle ring sequence along Z. */
function pushLoftedTube(arr, rings, rgba, mat) {
  for (let i = 0; i < rings.length - 1; i += 1) {
    const r0 = rings[i];
    const r1 = rings[i + 1];
    const segs = r0.segs ?? 10;
    for (let s = 0; s < segs; s += 1) {
      const a0 = (s / segs) * Math.PI * 2;
      const a1 = ((s + 1) / segs) * Math.PI * 2;
      const p00 = { x: r0.cx + Math.cos(a0) * r0.rx, y: r0.cy + Math.sin(a0) * r0.ry, z: r0.z };
      const p10 = { x: r0.cx + Math.cos(a1) * r0.rx, y: r0.cy + Math.sin(a1) * r0.ry, z: r0.z };
      const p11 = { x: r1.cx + Math.cos(a1) * r1.rx, y: r1.cy + Math.sin(a1) * r1.ry, z: r1.z };
      const p01 = { x: r1.cx + Math.cos(a0) * r1.rx, y: r1.cy + Math.sin(a0) * r1.ry, z: r1.z };
      const midA = (a0 + a1) * 0.5;
      const hint = { x: Math.cos(midA), y: Math.sin(midA), z: 0 };
      const col = r0.rgba ?? rgba;
      pushVertexQuad(arr, p00, p10, p11, p01, col, mat, hint);
    }
  }
}

function pushBox(arr, cx, cy, cz, hx, hy, hz, rgba, mat) {
  const v = [
    { x: cx - hx, y: cy - hy, z: cz - hz },
    { x: cx + hx, y: cy - hy, z: cz - hz },
    { x: cx + hx, y: cy + hy, z: cz - hz },
    { x: cx - hx, y: cy + hy, z: cz - hz },
    { x: cx - hx, y: cy - hy, z: cz + hz },
    { x: cx + hx, y: cy - hy, z: cz + hz },
    { x: cx + hx, y: cy + hy, z: cz + hz },
    { x: cx - hx, y: cy + hy, z: cz + hz },
  ];
  pushVertexQuad(arr, v[4], v[5], v[6], v[7], rgba, mat, { x: 0, y: 0, z: 1 });
  pushVertexQuad(arr, v[1], v[0], v[3], v[2], rgba, mat, { x: 0, y: 0, z: -1 });
  pushVertexQuad(arr, v[3], v[7], v[6], v[2], rgba, mat, { x: 0, y: 1, z: 0 });
  pushVertexQuad(arr, v[0], v[1], v[5], v[4], rgba, mat, { x: 0, y: -1, z: 0 });
  pushVertexQuad(arr, v[5], v[1], v[2], v[6], rgba, mat, { x: 1, y: 0, z: 0 });
  pushVertexQuad(arr, v[0], v[4], v[7], v[3], rgba, mat, { x: -1, y: 0, z: 0 });
}

/** Build static sculpted SC-7 Solara Corsair airframe vertex array (13 floats/vertex). */
export function buildSculptedAirframeData() {
  const arr = [];

  // Central sculpted seaplane fuselage lofted from aft tail cone to nose radome
  pushLoftedTube(arr, [
    { cx: 0, cy: 0.15, z: -2.2, rx: 0.22, ry: 0.22, segs: 10, rgba: RGBA_SLATE },
    { cx: 0, cy: 0.12, z: -0.9, rx: 0.72, ry: 0.68, segs: 10, rgba: RGBA_IVORY },
    { cx: 0, cy: 0.10, z: 1.1, rx: 0.86, ry: 0.80, segs: 10, rgba: RGBA_IVORY },
    { cx: 0, cy: 0.06, z: 2.8, rx: 0.78, ry: 0.70, segs: 10, rgba: RGBA_CRIMSON },
    { cx: 0, cy: 0.04, z: 3.9, rx: 0.50, ry: 0.45, segs: 10, rgba: RGBA_CRIMSON },
    { cx: 0, cy: 0.02, z: 4.5, rx: 0.12, ry: 0.12, segs: 10, rgba: RGBA_CHROME },
  ], RGBA_IVORY, MAT_PAINT);

  // Ventral seaplane hull step & dorsal racing spine
  pushBox(arr, 0, -0.78, 0.65, 0.48, 0.20, 2.15, RGBA_SLATE, MAT_MATTE);
  pushBox(arr, 0, 0.88, -0.3, 0.22, 0.12, 1.45, RGBA_CRIMSON, MAT_PAINT);

  // Sculpted bubble canopy dome
  pushLoftedTube(arr, [
    { cx: 0, cy: 0.76, z: 0.0, rx: 0.56, ry: 0.18, segs: 8 },
    { cx: 0, cy: 1.18, z: 0.9, rx: 0.58, ry: 0.42, segs: 8 },
    { cx: 0, cy: 1.08, z: 1.9, rx: 0.52, ry: 0.34, segs: 8 },
    { cx: 0, cy: 0.75, z: 2.65, rx: 0.22, ry: 0.14, segs: 8 },
  ], RGBA_CANOPY, MAT_GLASS);

  // Tapered high-mount gull wings, engine nacelles, twin tail booms, pontoons & nav lights
  for (const side of [-1, 1]) {
    // Inner & outer wing thickness slabs (top + bottom + leading/trailing bevels)
    const rootTop = [
      { x: side * 0.7, y: 0.65, z: 1.45 },
      { x: side * 5.8, y: 0.92, z: 0.80 },
      { x: side * 5.6, y: 0.86, z: -0.95 },
      { x: side * 0.7, y: 0.58, z: -0.75 },
    ];
    const rootBot = rootTop.map((p) => ({ x: p.x, y: p.y - 0.18, z: p.z }));
    pushVertexQuad(arr, rootTop[0], rootTop[1], rootTop[2], rootTop[3], RGBA_IVORY, MAT_PAINT, { x: 0, y: 1, z: 0 });
    pushVertexQuad(arr, rootBot[0], rootBot[1], rootBot[2], rootBot[3], RGBA_SLATE, MAT_PAINT, { x: 0, y: -1, z: 0 });
    pushVertexQuad(arr, rootTop[0], rootTop[1], rootBot[1], rootBot[0], RGBA_CRIMSON, MAT_PAINT, { x: 0, y: 0, z: 1 });

    // Crimson swept wingtip
    const tipTop = [
      { x: side * 5.8, y: 0.92, z: 0.80 },
      { x: side * 7.45, y: 1.18, z: 0.20 },
      { x: side * 7.20, y: 1.10, z: -0.95 },
      { x: side * 5.6, y: 0.86, z: -0.95 },
    ];
    const tipBot = tipTop.map((p) => ({ x: p.x, y: p.y - 0.12, z: p.z }));
    pushVertexQuad(arr, tipTop[0], tipTop[1], tipTop[2], tipTop[3], RGBA_CRIMSON, MAT_PAINT, { x: 0, y: 1, z: 0 });
    pushVertexQuad(arr, tipBot[0], tipBot[1], tipBot[2], tipBot[3], RGBA_CRIMSON, MAT_PAINT, { x: 0, y: -1, z: 0 });

    // Wingtip navigation beacon (port red, starboard green)
    pushBox(arr, side * 7.42, 1.12, -0.35, 0.14, 0.10, 0.24, side < 0 ? RGBA_NAV_RED : RGBA_NAV_GREEN, MAT_EMISSIVE);

    // Wing-mounted twin engine nacelles + twin tail booms
    pushLoftedTube(arr, [
      { cx: side * 2.15, cy: 0.42, z: -5.25, rx: 0.18, ry: 0.18, segs: 8, rgba: RGBA_SLATE },
      { cx: side * 2.15, cy: 0.48, z: -1.8, rx: 0.24, ry: 0.24, segs: 8, rgba: RGBA_SLATE },
      { cx: side * 2.15, cy: 0.56, z: 0.4, rx: 0.42, ry: 0.40, segs: 8, rgba: RGBA_IVORY },
      { cx: side * 2.15, cy: 0.56, z: 2.05, rx: 0.40, ry: 0.38, segs: 8, rgba: RGBA_CRIMSON },
      { cx: side * 2.15, cy: 0.56, z: 2.45, rx: 0.14, ry: 0.14, segs: 8, rgba: RGBA_CHROME },
    ], RGBA_IVORY, MAT_METAL);

    // Wingtip stabilizer floats
    pushLoftedTube(arr, [
      { cx: side * 4.45, cy: -0.58, z: -1.35, rx: 0.16, ry: 0.16, segs: 6, rgba: RGBA_SLATE },
      { cx: side * 4.45, cy: -0.58, z: 0.15, rx: 0.28, ry: 0.24, segs: 6, rgba: RGBA_CRIMSON },
      { cx: side * 4.45, cy: -0.55, z: 1.55, rx: 0.12, ry: 0.12, segs: 6, rgba: RGBA_IVORY },
    ], RGBA_CRIMSON, MAT_PAINT);
    pushBox(arr, side * 4.45, 0.05, 0.15, 0.07, 0.62, 0.18, RGBA_SLATE, MAT_METAL);

    // Swept vertical stabilizers + tail strobe light
    const finA = { x: side * 2.15, y: 0.55, z: -3.6 };
    const finB = { x: side * 2.15, y: 0.55, z: -5.3 };
    const finC = { x: side * 2.15, y: 2.45, z: -5.55 };
    const finD = { x: side * 2.15, y: 2.35, z: -4.45 };
    pushVertexQuad(arr, finA, finB, finC, finD, RGBA_CRIMSON, MAT_PAINT, { x: side, y: 0, z: 0 });
    pushBox(arr, side * 2.15, 2.45, -5.45, 0.09, 0.09, 0.14, RGBA_NAV_WHITE, MAT_EMISSIVE);
  }

  // Elevated horizontal tailplane connecting twin booms
  pushBox(arr, 0, 1.92, -4.95, 2.25, 0.08, 0.52, RGBA_IVORY, MAT_PAINT);

  return new Float32Array(arr);
}

/** Build dynamic per-frame aircraft parts: control surfaces, gear, twin prop discs, exhaust flame. */
export function buildAircraftDynamicData(ac) {
  const arr = [];

  for (const side of [-1, 1]) {
    const ail = side * ac.aileronInput * 0.26 + (ac.flaps ? -0.34 : 0);
    const f0 = { x: side * 1.4, y: 0.58, z: -0.75 };
    const f1 = { x: side * 5.4, y: 0.84, z: -0.95 };
    const f2 = { x: side * 5.3, y: 0.82 + ail, z: -1.48 };
    const f3 = { x: side * 1.4, y: 0.56 + ail, z: -1.32 };
    pushVertexQuad(arr, f0, f1, f2, f3, RGBA_SLATE, MAT_PAINT, { x: 0, y: 1, z: 0 });

    // Spinning wing nacelle propeller blades + translucent prop blur disc
    const cx = side * 2.15;
    const cy = 0.56;
    const cz = 2.48;
    const segs = 12;
    const rad = 1.18;
    for (let s = 0; s < segs; s += 1) {
      const a0 = (s / segs) * Math.PI * 2;
      const a1 = ((s + 1) / segs) * Math.PI * 2;
      pushVertexTri(
        arr,
        { x: cx, y: cy, z: cz },
        { x: cx + Math.cos(a0) * rad, y: cy + Math.sin(a0) * rad, z: cz },
        { x: cx + Math.cos(a1) * rad, y: cy + Math.sin(a1) * rad, z: cz },
        RGBA_PROP_DISC,
        MAT_GLASS,
        { x: 0, y: 0, z: 1 },
      );
    }
    for (let b = 0; b < 3; b += 1) {
      const ang = ac.propAngle + side * 0.8 + (b * Math.PI * 2) / 3;
      const bx = Math.cos(ang) * rad;
      const by = Math.sin(ang) * rad;
      const px = -Math.sin(ang) * 0.08;
      const py = Math.cos(ang) * 0.08;
      pushVertexQuad(
        arr,
        { x: cx - px, y: cy - py, z: cz + 0.03 },
        { x: cx + px, y: cy + py, z: cz + 0.03 },
        { x: cx + bx + px * 0.4, y: cy + by + py * 0.4, z: cz + 0.03 },
        { x: cx + bx - px * 0.4, y: cy + by - py * 0.4, z: cz + 0.03 },
        RGBA_CHROME,
        MAT_METAL,
        { x: 0, y: 0, z: 1 },
      );
    }
  }

  // Animated elevator
  const elevY = 1.92 + ac.elevatorInput * 0.24;
  pushVertexQuad(
    arr,
    { x: -2.0, y: 1.92, z: -5.45 },
    { x: 2.0, y: 1.92, z: -5.45 },
    { x: 2.0, y: elevY, z: -5.92 },
    { x: -2.0, y: elevY, z: -5.92 },
    RGBA_CRIMSON,
    MAT_PAINT,
    { x: 0, y: 1, z: 0 },
  );

  // Retractable tricycle landing gear struts + wheels
  if (ac.gearDeploy > 0.08) {
    const drop = ac.gearDeploy;
    pushBox(arr, 0, -0.75 - 0.5 * drop, 2.5, 0.08, 0.45 * drop, 0.08, RGBA_CHROME, MAT_METAL);
    pushBox(arr, 0, -0.78 - 0.92 * drop, 2.5, 0.14, 0.24, 0.24, RGBA_TIRE, MAT_MATTE);
    for (const s of [-1, 1]) {
      pushBox(arr, s * 1.3, -0.65 - 0.55 * drop, -0.1, 0.09, 0.5 * drop, 0.09, RGBA_CHROME, MAT_METAL);
      pushBox(arr, s * 1.3, -0.68 - 0.98 * drop, -0.1, 0.16, 0.28, 0.28, RGBA_TIRE, MAT_MATTE);
    }
  }

  // Overdrive afterburner / exhaust glow cone
  if (ac.boosting) {
    const flicker = 0.85 + 0.2 * Math.sin(ac.propAngle * 3.1);
    pushBox(arr, 0, 0.08, -2.55 - 0.55 * flicker, 0.34, 0.26, 0.72 * flicker, RGBA_EXHAUST, MAT_EMISSIVE);
  }

  return new Float32Array(arr);
}
