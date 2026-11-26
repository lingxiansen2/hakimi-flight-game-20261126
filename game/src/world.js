// Solara Archipelago world generator: terrain heightfield, islands, airstrips, landmarks, and clouds.

import { clamp, hexToRgb, lerp } from './math3d.js';
import { PALETTE } from './config.js';

function hash2(ix, iz) {
  const h = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453123;
  return h - Math.floor(h);
}

function valueNoise(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uz);
}

function fbm(x, z) {
  let sum = 0;
  let amp = 0.55;
  let freq = 1;
  for (let i = 0; i < 3; i += 1) {
    sum += amp * (valueNoise(x * freq, z * freq) * 2 - 1);
    freq *= 2.05;
    amp *= 0.48;
  }
  return sum;
}

export const RUNWAYS = [
  {
    id: 'solara',
    name: 'Solara Airfield (RWY 36/18)',
    x: 0,
    z: 0,
    y: 18,
    yaw: 0,
    length: 480,
    width: 38,
  },
  {
    id: 'windward',
    name: 'Windward Cliff Strip (RWY 18/36)',
    x: 1380,
    z: -480,
    y: 66,
    yaw: 0.08,
    length: 390,
    width: 34,
  },
  {
    id: 'atoll',
    name: 'Coral Atoll Strip (RWY 04/22)',
    x: -1360,
    z: -1180,
    y: 12,
    yaw: 0.65,
    length: 340,
    width: 32,
  },
];

export const LANDMARKS = [
  { kind: 'tower', x: 56, z: 30, y: 18, height: 34 },
  { kind: 'hangar', x: -64, z: -70, y: 18, width: 34, depth: 26, height: 14 },
  { kind: 'lighthouse', x: -1020, z: 1120, y: 58, height: 56 },
  { kind: 'turbine', x: 1240, z: -260, y: 74, height: 54, phase: 0.2 },
  { kind: 'turbine', x: 1520, z: -680, y: 88, height: 54, phase: 1.7 },
  { kind: 'turbine', x: 1490, z: -220, y: 72, height: 54, phase: 3.1 },
  { kind: 'relay', x: 150, z: 2880, y: 410, height: 48 },
];

const ISLANDS = [
  // Solara Airfield main coastal plateau
  { x: 0, z: 40, rx: 430, rz: 520, height: 32, flatTop: 18 },
  // Solara western ridge
  { x: -340, z: 160, rx: 240, rz: 300, height: 115, sharp: 1.3 },
  // Caldera Ridge (twin peaks + navigable central saddle pass around x=960, z=1620)
  { x: 740, z: 1620, rx: 320, rz: 360, height: 440, sharp: 1.5 },
  { x: 1210, z: 1640, rx: 330, rz: 370, height: 465, sharp: 1.55 },
  { x: 965, z: 1620, rx: 380, rz: 440, height: 140, flatTop: 110 },
  // Lighthouse Point + offshore sea-stacks
  { x: -1040, z: 1120, rx: 360, rz: 340, height: 96, flatTop: 58 },
  { x: -1290, z: 1360, rx: 95, rz: 95, height: 165, sharp: 2.1 },
  { x: -860, z: 1460, rx: 80, rz: 80, height: 145, sharp: 2.2 },
  // Windward Cliff Strip & Wind Farm
  { x: 1380, z: -480, rx: 360, rz: 450, height: 92, flatTop: 66 },
  { x: 1660, z: -640, rx: 240, rz: 280, height: 215, sharp: 1.4 },
  // Coral Atoll Crescent
  { x: -1360, z: -1180, rx: 340, rz: 360, height: 26, flatTop: 12 },
  { x: -1580, z: -1380, rx: 180, rz: 190, height: 85, sharp: 1.4 },
  // Northern Stormwatch Spire
  { x: 150, z: 2880, rx: 520, rz: 480, height: 510, sharp: 1.65 },
  { x: -240, z: 2660, rx: 240, rz: 240, height: 220, sharp: 1.5 },
];

/** Compute deterministic terrain elevation at world (x, z). Sea level is 0. */
export function getTerrainHeight(x, z) {
  let maxH = -6;
  const noise = fbm(x * 0.0028, z * 0.0028);

  for (let i = 0; i < ISLANDS.length; i += 1) {
    const isl = ISLANDS[i];
    const dx = (x - isl.x) / isl.rx;
    const dz = (z - isl.z) / isl.rz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= 1.35) continue;
    const falloff = Math.max(0, 1 - d2);
    const power = isl.sharp ?? 1.1;
    let h = Math.pow(falloff, power) * isl.height;
    h += noise * Math.min(48, isl.height * 0.22) * falloff;
    if (isl.flatTop && h > isl.flatTop) {
      h = lerp(isl.flatTop, h, 0.14);
    }
    if (h > maxH) maxH = h;
  }

  // Carve flat airstrip pads cleanly into island surfaces
  for (let i = 0; i < RUNWAYS.length; i += 1) {
    const r = RUNWAYS[i];
    const dx = x - r.x;
    const dz = z - r.z;
    const ca = Math.cos(r.yaw);
    const sa = Math.sin(r.yaw);
    const along = Math.abs(dx * sa + dz * ca);
    const across = Math.abs(dx * ca - dz * sa);
    const padL = r.length * 0.62;
    const padW = r.width * 1.9;
    if (along < padL && across < padW) {
      const blendAlong = clamp((padL - along) / 55, 0, 1);
      const blendAcross = clamp((padW - across) / 34, 0, 1);
      const blend = Math.min(blendAlong, blendAcross);
      maxH = lerp(maxH, r.y, blend);
    }
  }

  return maxH;
}

/** Check if (x, z) lies on a runway deck and return runway descriptor or null. */
export function findRunwayUnder(x, z) {
  for (let i = 0; i < RUNWAYS.length; i += 1) {
    const r = RUNWAYS[i];
    const dx = x - r.x;
    const dz = z - r.z;
    const ca = Math.cos(r.yaw);
    const sa = Math.sin(r.yaw);
    const along = Math.abs(dx * sa + dz * ca);
    const across = Math.abs(dx * ca - dz * sa);
    if (along <= r.length * 0.52 && across <= r.width * 0.62) {
      return r;
    }
  }
  return null;
}

const RGB_CACHE = {
  sand: hexToRgb(PALETTE.sand),
  grassLight: hexToRgb(PALETTE.grassLight),
  grassDark: hexToRgb(PALETTE.grassDark),
  rockLight: hexToRgb(PALETTE.rockLight),
  rockDark: hexToRgb(PALETTE.rockDark),
  volcanoPeak: hexToRgb(PALETTE.volcanoPeak),
  snowCap: hexToRgb(PALETTE.snowCap),
  shallows: hexToRgb(PALETTE.oceanShallows),
  oceanMid: hexToRgb(PALETTE.oceanMid),
  oceanDeep: hexToRgb(PALETTE.oceanDeep),
};

export function classifySurfaceRgb(avgY, slopeY) {
  if (avgY <= 0.6) {
    return avgY > -2.6 ? RGB_CACHE.shallows : RGB_CACHE.oceanMid;
  }
  if (avgY < 6.5) return RGB_CACHE.sand;
  if (slopeY < 0.72) return avgY > 180 ? RGB_CACHE.rockDark : RGB_CACHE.rockLight;
  if (avgY > 395) return RGB_CACHE.snowCap;
  if (avgY > 250) return RGB_CACHE.volcanoPeak;
  if (avgY > 140) return RGB_CACHE.rockLight;
  return avgY > 55 ? RGB_CACHE.grassDark : RGB_CACHE.grassLight;
}

/** Build deterministic layered volumetric clouds across the archipelago. */
export function createClouds() {
  const clouds = [];
  const anchors = [
    [-700, 470, 500], [520, 520, 740], [1150, 560, 1280], [-1150, 440, 1650],
    [100, 610, 2240], [-450, 510, -420], [1080, 480, -820], [-1450, 460, -680],
    [1680, 530, 320], [420, 490, -1420], [-820, 540, 2450], [1480, 590, 2120],
  ];
  for (let i = 0; i < anchors.length; i += 1) {
    const [cx, cy, cz] = anchors[i];
    const puffs = [];
    for (let j = 0; j < 4; j += 1) {
      const ang = (j / 4) * Math.PI * 2 + i * 0.7;
      puffs.push({
        ox: Math.cos(ang) * (46 + (j % 2) * 32),
        oy: (j % 2 === 0 ? 16 : -6),
        oz: Math.sin(ang) * (42 + (j % 2) * 26),
        rx: 74 + (j % 3) * 24,
        ry: 34 + (j % 2) * 14,
        rz: 62 + (j % 2) * 22,
      });
    }
    clouds.push({ x: cx, y: cy, z: cz, puffs });
  }
  return clouds;
}

/** Scatter deterministic low-poly trees on island slopes away from runways. */
export function createTrees() {
  const trees = [];
  for (let i = 0; i < 95; i += 1) {
    const isl = ISLANDS[i % ISLANDS.length];
    const ang = hash2(i, 11) * Math.PI * 2;
    const rad = 0.18 + hash2(i, 23) * 0.56;
    const x = isl.x + Math.cos(ang) * isl.rx * rad;
    const z = isl.z + Math.sin(ang) * isl.rz * rad;
    const y = getTerrainHeight(x, z);
    if (y < 8 || y > 160 || findRunwayUnder(x, z)) continue;
    // Keep clear of runway lateral approach corridors
    let nearRunway = false;
    for (let r = 0; r < RUNWAYS.length; r += 1) {
      const rw = RUNWAYS[r];
      if (Math.abs(x - rw.x) < rw.width * 2.2 && Math.abs(z - rw.z) < rw.length * 0.7) {
        nearRunway = true;
        break;
      }
    }
    if (nearRunway) continue;
    trees.push({ x, y, z, h: 11 + hash2(i, 37) * 9, r: 4.5 + hash2(i, 51) * 3 });
  }
  return trees;
}

export function createWorld() {
  const clouds = createClouds();
  const trees = createTrees();
  return {
    runways: RUNWAYS,
    landmarks: LANDMARKS,
    clouds,
    trees,
    getHeight: getTerrainHeight,
    findRunway: findRunwayUnder,
  };
}
