// Solara Archipelago world: high-detail FBM ridge terrain, airstrips, CVN-07 carrier, harbor, and landmarks.

import { clamp, lerp } from './math3d.js';

export const WORLD_HALF_EXTENT = 4200;

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

function ridgeFbm(x, z) {
  let sum = 0;
  let amp = 0.52;
  let freq = 1.0;
  for (let i = 0; i < 5; i += 1) {
    const n = valueNoise(x * freq, z * freq) * 2 - 1;
    const ridge = 1 - Math.abs(n);
    sum += amp * (ridge * 0.65 + n * 0.35);
    freq *= 2.08;
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
    isCarrier: false,
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
    isCarrier: false,
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
    isCarrier: false,
  },
  {
    id: 'carrier',
    name: 'CVN-07 Solara Carrier Deck',
    x: -520,
    z: 1880,
    y: 22,
    yaw: 0.18,
    length: 290,
    width: 50,
    isCarrier: true,
  },
];

export const LANDMARKS = [
  { kind: 'tower', x: 56, z: 30, y: 18, height: 36 },
  { kind: 'hangar', x: -64, z: -70, y: 18, width: 36, depth: 28, height: 15 },
  { kind: 'hangar', x: -64, z: -120, y: 18, width: 32, depth: 24, height: 14 },
  { kind: 'windsock', x: 34, z: -165, y: 18, height: 13 },
  { kind: 'harbor', x: 255, z: -140, y: 0.5, yaw: 0.2 },
  { kind: 'lighthouse', x: -1020, z: 1120, y: 58, height: 58 },
  { kind: 'turbine', x: 1240, z: -260, y: 74, height: 56, phase: 0.2 },
  { kind: 'turbine', x: 1520, z: -680, y: 88, height: 56, phase: 1.7 },
  { kind: 'turbine', x: 1490, z: -220, y: 72, height: 56, phase: 3.1 },
  { kind: 'turbine', x: 1620, z: -420, y: 82, height: 56, phase: 4.2 },
  { kind: 'relay', x: 150, z: 2880, y: 410, height: 50 },
];

export const THERMALS = [
  { x: 960, z: 1620, radius: 220, lift: 7.5 },
  { x: 480, z: 2200, radius: 190, lift: 6.0 },
];

const ISLANDS = [
  { x: 0, z: 40, rx: 450, rz: 540, height: 34, flatTop: 18 },
  { x: -340, z: 160, rx: 250, rz: 310, height: 128, sharp: 1.3 },
  { x: 740, z: 1620, rx: 330, rz: 370, height: 455, sharp: 1.45 },
  { x: 1210, z: 1640, rx: 340, rz: 380, height: 475, sharp: 1.5 },
  { x: 965, z: 1620, rx: 390, rz: 450, height: 145, flatTop: 112 },
  { x: -1040, z: 1120, rx: 370, rz: 350, height: 102, flatTop: 58 },
  { x: -1290, z: 1360, rx: 100, rz: 100, height: 175, sharp: 2.0 },
  { x: -860, z: 1460, rx: 85, rz: 85, height: 150, sharp: 2.1 },
  { x: 1380, z: -480, rx: 380, rz: 460, height: 96, flatTop: 66 },
  { x: 1660, z: -640, rx: 250, rz: 290, height: 228, sharp: 1.4 },
  { x: -1360, z: -1180, rx: 350, rz: 370, height: 28, flatTop: 12 },
  { x: -1580, z: -1380, rx: 190, rz: 200, height: 92, sharp: 1.4 },
  { x: 150, z: 2880, rx: 540, rz: 490, height: 525, sharp: 1.6 },
  { x: -240, z: 2660, rx: 250, rz: 250, height: 230, sharp: 1.45 },
];

export function getTerrainHeight(x, z) {
  let maxH = -16;
  const noise = ridgeFbm(x * 0.0032, z * 0.0032);
  const crag = ridgeFbm(x * 0.0078 + 13.7, z * 0.0078 - 9.2);

  for (let i = 0; i < ISLANDS.length; i += 1) {
    const isl = ISLANDS[i];
    const dx = (x - isl.x) / isl.rx;
    const dz = (z - isl.z) / isl.rz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= 1.45) continue;
    const falloff = Math.max(0, 1 - d2);
    const power = isl.sharp ?? 1.1;
    let h = Math.pow(falloff, power) * isl.height;
    const detailAmp = Math.min(138, isl.height * 0.42);
    h += ((noise - 0.12) * 0.72 + (crag - 0.1) * 0.42) * detailAmp * falloff;
    if (isl.flatTop && h > isl.flatTop) {
      h = lerp(isl.flatTop, h, 0.12);
    }
    if (h > maxH) maxH = h;
  }

  for (let i = 0; i < RUNWAYS.length; i += 1) {
    const r = RUNWAYS[i];
    if (r.isCarrier) continue;
    const dx = x - r.x;
    const dz = z - r.z;
    const ca = Math.cos(r.yaw);
    const sa = Math.sin(r.yaw);
    const along = Math.abs(dx * sa + dz * ca);
    const across = Math.abs(dx * ca - dz * sa);
    const padL = r.length * 0.62;
    const padW = r.width * 1.9;
    if (along < padL && across < padW) {
      const blend = Math.min(clamp((padL - along) / 55, 0, 1), clamp((padW - across) / 34, 0, 1));
      maxH = lerp(maxH, r.y, blend);
    }
  }

  return maxH;
}

/** Return effective deck/ground elevation including the aircraft carrier flight deck. */
export function getSurfaceHeightWithCarrier(x, z) {
  const rw = findRunwayUnder(x, z);
  if (rw && rw.isCarrier) return rw.y;
  return getTerrainHeight(x, z);
}

export function findRunwayUnder(x, z) {
  for (let i = 0; i < RUNWAYS.length; i += 1) {
    const r = RUNWAYS[i];
    const dx = x - r.x;
    const dz = z - r.z;
    const ca = Math.cos(r.yaw);
    const sa = Math.sin(r.yaw);
    const along = Math.abs(dx * sa + dz * ca);
    const across = Math.abs(dx * ca - dz * sa);
    if (along <= r.length * 0.52 && across <= r.width * 0.62) return r;
  }
  return null;
}

export function getThermalLift(x, z) {
  let lift = 0;
  for (let i = 0; i < THERMALS.length; i += 1) {
    const t = THERMALS[i];
    const d = Math.hypot(x - t.x, z - t.z);
    if (d < t.radius) lift += t.lift * (1 - d / t.radius);
  }
  return lift;
}

export function createClouds() {
  const clouds = [];
  const anchors = [
    [-700, 460, 500], [520, 510, 740], [1150, 540, 1280], [-1150, 420, 1650],
    [100, 590, 2240], [-450, 490, -420], [1080, 470, -820], [-1450, 450, -680],
    [1680, 520, 320], [420, 480, -1420], [-820, 520, 2450], [1480, 560, 2120],
    [-600, 360, 1520], [-360, 390, 2050],
  ];
  for (let i = 0; i < anchors.length; i += 1) {
    const [cx, cy, cz] = anchors[i];
    const puffs = [];
    for (let j = 0; j < 5; j += 1) {
      const ang = (j / 5) * Math.PI * 2 + i * 0.7;
      puffs.push({
        ox: Math.cos(ang) * (42 + (j % 2) * 34),
        oy: (j % 2 === 0 ? 18 : -6) + (j === 4 ? 22 : 0),
        oz: Math.sin(ang) * (38 + (j % 2) * 26),
        rx: 68 + (j % 3) * 24,
        ry: 32 + (j % 2) * 14,
        rz: 58 + (j % 2) * 22,
      });
    }
    clouds.push({ x: cx, y: cy, z: cz, puffs });
  }
  return clouds;
}

export function createTrees() {
  const trees = [];
  for (let i = 0; i < 220; i += 1) {
    const isl = ISLANDS[i % ISLANDS.length];
    const ang = hash2(i, 11) * Math.PI * 2;
    const rad = 0.14 + hash2(i, 23) * 0.62;
    const x = isl.x + Math.cos(ang) * isl.rx * rad;
    const z = isl.z + Math.sin(ang) * isl.rz * rad;
    const y = getTerrainHeight(x, z);
    if (y < 7 || y > 175 || findRunwayUnder(x, z)) continue;
    let nearRunway = false;
    for (let r = 0; r < RUNWAYS.length; r += 1) {
      const rw = RUNWAYS[r];
      if (!rw.isCarrier && Math.abs(x - rw.x) < rw.width * 2.4 && Math.abs(z - rw.z) < rw.length * 0.72) {
        nearRunway = true;
        break;
      }
    }
    if (nearRunway) continue;
    trees.push({ x, y, z, h: 12 + hash2(i, 37) * 10, r: 4.5 + hash2(i, 51) * 3.5 });
  }
  return trees;
}

export function createWorld() {
  return {
    runways: RUNWAYS,
    landmarks: LANDMARKS,
    clouds: createClouds(),
    trees: createTrees(),
    getHeight: getTerrainHeight,
    getSurfaceHeight: getSurfaceHeightWithCarrier,
    findRunway: findRunwayUnder,
    getThermalLift,
  };
}
