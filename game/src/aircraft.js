// Multi-part 3D articulated Solara Corsair twin-boom bush seaplane mesh generator.

import { buildBasis, hexToRgb, localToWorld } from './math3d.js';
import { PALETTE } from './config.js';

const C_CREAM = hexToRgb(PALETTE.hullCream);
const C_CRIMSON = hexToRgb(PALETTE.hullCrimson);
const C_SLATE = hexToRgb(PALETTE.hullSlate);
const C_CANOPY = hexToRgb(PALETTE.canopyGlass);
const C_SILVER = [208, 218, 228];
const C_DARK = [32, 38, 48];
const C_EXHAUST = [255, 162, 66];

/** Helper to push a box prism centered at (cx, cy, cz) with half-extents (hx, hy, hz). */
function pushBox(tris, cx, cy, cz, hx, hy, hz, rgb, doubleSided = false) {
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
  const faces = [
    [4, 5, 6, 7], // front +z
    [1, 0, 3, 2], // back -z
    [3, 7, 6, 2], // top +y
    [0, 1, 5, 4], // bottom -y
    [5, 1, 2, 6], // right +x
    [0, 4, 7, 3], // left -x
  ];
  for (let i = 0; i < faces.length; i += 1) {
    const [a, b, c, d] = faces[i];
    tris.push({ pts: [v[a], v[b], v[c], v[d]], rgb, doubleSided });
  }
}

/** Build transformed 3D polygons for the player aircraft in world space. */
export function buildAircraftPolygons(ac) {
  const basis = buildBasis(ac.yaw, ac.pitch, ac.roll);
  const localQuads = [];

  // Central streamlined fuselage pod (twin-boom pusher/tractor bush corsair)
  pushBox(localQuads, 0, 0.1, 0.6, 0.85, 0.72, 2.75, C_CREAM);
  // Dorsal crimson racing spine & nose engine cowling
  pushBox(localQuads, 0, 0.84, 0.0, 0.36, 0.12, 1.85, C_CRIMSON);
  pushBox(localQuads, 0, 0.05, 3.65, 0.68, 0.56, 0.65, C_CRIMSON);
  // Tapered spinner cone on nose
  pushBox(localQuads, 0, 0.05, 4.42, 0.24, 0.24, 0.32, C_SILVER);
  // Ventral seaplane hull keel
  pushBox(localQuads, 0, -0.78, 0.5, 0.62, 0.28, 2.4, C_SLATE);
  // Cockpit rear bulkhead & headrest visible from chase view
  pushBox(localQuads, 0, 0.95, 0.4, 0.42, 0.32, 0.22, C_SLATE);

  // Tinted bubble canopy over cockpit
  localQuads.push({
    pts: [
      { x: -0.62, y: 0.75, z: 2.35 },
      { x: 0.62, y: 0.75, z: 2.35 },
      { x: 0.55, y: 1.48, z: 1.35 },
      { x: -0.55, y: 1.48, z: 1.35 },
    ],
    rgb: C_CANOPY,
    doubleSided: true,
  });
  localQuads.push({
    pts: [
      { x: -0.55, y: 1.48, z: 1.35 },
      { x: 0.55, y: 1.48, z: 1.35 },
      { x: 0.58, y: 0.82, z: -0.45 },
      { x: -0.58, y: 0.82, z: -0.45 },
    ],
    rgb: C_CANOPY,
    doubleSided: true,
  });

  // Main swept high wings (left and right) with crimson tip accents
  for (const side of [-1, 1]) {
    localQuads.push({
      pts: [
        { x: side * 0.75, y: 0.55, z: 1.35 },
        { x: side * 5.8, y: 0.82, z: 0.65 },
        { x: side * 5.65, y: 0.78, z: -0.95 },
        { x: side * 0.75, y: 0.52, z: -0.75 },
      ],
      rgb: C_CREAM,
      doubleSided: true,
    });
    // Crimson outer wingtip panels
    localQuads.push({
      pts: [
        { x: side * 5.8, y: 0.82, z: 0.65 },
        { x: side * 7.25, y: 1.05, z: 0.25 },
        { x: side * 7.05, y: 0.98, z: -0.95 },
        { x: side * 5.65, y: 0.78, z: -0.95 },
      ],
      rgb: C_CRIMSON,
      doubleSided: true,
    });
    // Animated aileron + flap strip
    const ailDeflect = side * ac.aileronInput * 0.28 + (ac.flaps ? -0.32 : 0);
    localQuads.push({
      pts: [
        { x: side * 1.4, y: 0.52, z: -0.75 },
        { x: side * 5.4, y: 0.76, z: -0.95 },
        { x: side * 5.3, y: 0.74 + ailDeflect, z: -1.48 },
        { x: side * 1.4, y: 0.5 + ailDeflect, z: -1.32 },
      ],
      rgb: C_SLATE,
      doubleSided: true,
    });
    // Under-wing pontoons / floats
    pushBox(localQuads, side * 4.2, -0.55, 0.1, 0.26, 0.24, 1.35, C_CRIMSON);
    // Twin tail booms
    pushBox(localQuads, side * 1.95, 0.42, -2.55, 0.22, 0.22, 2.55, C_SLATE);
    // Twin vertical stabilizers
    localQuads.push({
      pts: [
        { x: side * 1.95, y: 0.55, z: -3.7 },
        { x: side * 1.95, y: 0.55, z: -5.15 },
        { x: side * 1.95, y: 2.35, z: -5.35 },
        { x: side * 1.95, y: 2.25, z: -4.45 },
      ],
      rgb: C_CRIMSON,
      doubleSided: true,
    });
  }

  // Horizontal tailplane spanning twin booms + animated elevator
  localQuads.push({
    pts: [
      { x: -2.15, y: 1.85, z: -4.55 },
      { x: 2.15, y: 1.85, z: -4.55 },
      { x: 2.15, y: 1.85 + ac.elevatorInput * 0.22, z: -5.35 },
      { x: -2.15, y: 1.85 + ac.elevatorInput * 0.22, z: -5.35 },
    ],
    rgb: C_CREAM,
    doubleSided: true,
  });

  // Retractable tricycle landing gear when deployed
  if (ac.gearDeploy > 0.1) {
    const drop = ac.gearDeploy;
    pushBox(localQuads, 0, -0.65 - 0.55 * drop, 2.4, 0.14, 0.35 * drop, 0.25, C_DARK);
    pushBox(localQuads, -1.3, -0.55 - 0.65 * drop, -0.2, 0.16, 0.38 * drop, 0.32, C_DARK);
    pushBox(localQuads, 1.3, -0.55 - 0.65 * drop, -0.2, 0.16, 0.38 * drop, 0.32, C_DARK);
  }

  // Spinning nose propeller blades + overdrive thruster glow
  const bladeA = ac.propAngle;
  for (let b = 0; b < 2; b += 1) {
    const ang = bladeA + b * (Math.PI * 0.5);
    const dx = Math.cos(ang) * 1.55;
    const dy = Math.sin(ang) * 1.55;
    const px = -Math.sin(ang) * 0.12;
    const py = Math.cos(ang) * 0.12;
    localQuads.push({
      pts: [
        { x: -dx - px, y: 0.05 - dy - py, z: 4.38 },
        { x: -dx + px, y: 0.05 - dy + py, z: 4.38 },
        { x: dx + px, y: 0.05 + dy + py, z: 4.38 },
        { x: dx - px, y: 0.05 + dy - py, z: 4.38 },
      ],
      rgb: C_SILVER,
      doubleSided: true,
    });
  }
  if (ac.boosting) {
    pushBox(localQuads, 0, 0.2, -2.35, 0.32, 0.24, 0.45, C_EXHAUST, true);
  }

  return localQuads.map((q) => ({
    pts: q.pts.map((p) => localToWorld(p, ac.pos, basis)),
    rgb: q.rgb,
    doubleSided: Boolean(q.doubleSided),
    isAircraft: true,
    stroke: 'rgba(15, 23, 42, 0.35)',
  }));
}
