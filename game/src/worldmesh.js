// Static GPU geometry builders: terrain, weathered tarmac runways, CVN-07 carrier, harbor town, bridge & lava caldera.

import { pushVertexQuad, pushVertexTri } from './math3d.js';
import { WORLD_HALF_EXTENT } from './world.js';

const C_ASPHALT = [0.18, 0.20, 0.24, 1];
const C_DECK = [0.20, 0.22, 0.26, 1];
const C_WHITE = [0.96, 0.95, 0.92, 1];
const C_YELLOW = [0.96, 0.77, 0.24, 1];
const C_RED = [0.88, 0.25, 0.21, 1];
const C_TERRACOTTA = [0.80, 0.38, 0.26, 1];
const C_CREAM = [0.94, 0.90, 0.82, 1];
const C_STEEL = [0.34, 0.39, 0.46, 1];
const C_GREEN_LIT = [0.22, 0.94, 0.45, 1];
const C_AMBER_LIT = [1.0, 0.72, 0.18, 1];
const C_MAGMA = [1.0, 0.42, 0.08, 1];
const C_HULL = [0.30, 0.34, 0.40, 1];
const C_WOOD = [0.48, 0.34, 0.22, 1];
const C_GLASS = [0.35, 0.76, 0.92, 0.92];
const C_PINE_A = [0.13, 0.40, 0.20, 1];
const C_PINE_B = [0.19, 0.48, 0.24, 1];

const M_MATTE = [0.85, 0.04, 0.0];
const M_PAINT = [0.45, 0.15, 0.0];
const M_METAL = [0.28, 0.68, 0.0];
const M_GLASS = [0.10, 0.35, 0.15];
const M_EMISSIVE = [0.25, 0.0, 1.45];
const M_MAGMA = [0.2, 0.0, 1.95];

function pushBox(arr, cx, cy, cz, hx, hy, hz, rgba, mat, yaw = 0, ox = 0, oy = 0, oz = 0, uvScale = null) {
  const ca = Math.cos(yaw);
  const sa = Math.sin(yaw);
  const xform = (lx, ly, lz) => ({
    x: ox + (cx + lx) * ca + (cz + lz) * sa,
    y: oy + cy + ly,
    z: oz - (cx + lx) * sa + (cz + lz) * ca,
  });
  const v = [
    xform(-hx, -hy, -hz), xform(hx, -hy, -hz), xform(hx, hy, -hz), xform(-hx, hy, -hz),
    xform(-hx, -hy, hz), xform(hx, -hy, hz), xform(hx, hy, hz), xform(-hx, hy, hz),
  ];
  const rVec = (lx, ly, lz) => ({ x: lx * ca + lz * sa, y: ly, z: -lx * sa + lz * ca });
  pushVertexQuad(arr, v[4], v[5], v[6], v[7], rgba, mat, rVec(0, 0, 1), uvScale);
  pushVertexQuad(arr, v[1], v[0], v[3], v[2], rgba, mat, rVec(0, 0, -1), uvScale);
  pushVertexQuad(arr, v[3], v[7], v[6], v[2], rgba, mat, rVec(0, 1, 0), uvScale);
  pushVertexQuad(arr, v[0], v[1], v[5], v[4], rgba, mat, rVec(0, -1, 0), uvScale);
  pushVertexQuad(arr, v[5], v[1], v[2], v[6], rgba, mat, rVec(1, 0, 0), uvScale);
  pushVertexQuad(arr, v[0], v[4], v[7], v[3], rgba, mat, rVec(-1, 0, 0), uvScale);
}

/** Build high-density terrain vertex/index buffers with central-difference smooth normals. */
export function buildStaticTerrainBuffers(world) {
  const N = 220;
  const span = WORLD_HALF_EXTENT * 2;
  const step = span / N;
  const verts = new Float32Array((N + 1) * (N + 1) * 6);
  const eps = 12;

  for (let iz = 0; iz <= N; iz += 1) {
    const wz = -WORLD_HALF_EXTENT + iz * step;
    for (let ix = 0; ix <= N; ix += 1) {
      const wx = -WORLD_HALF_EXTENT + ix * step;
      const h = world.getHeight(wx, wz);
      const hx0 = world.getHeight(wx - eps, wz);
      const hx1 = world.getHeight(wx + eps, wz);
      const hz0 = world.getHeight(wx, wz - eps);
      const hz1 = world.getHeight(wx, wz + eps);
      let nx = hx0 - hx1;
      let ny = 2 * eps;
      let nz = hz0 - hz1;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;

      const idx = (iz * (N + 1) + ix) * 6;
      verts[idx] = wx;
      verts[idx + 1] = h;
      verts[idx + 2] = wz;
      verts[idx + 3] = nx;
      verts[idx + 4] = ny;
      verts[idx + 5] = nz;
    }
  }

  const indices = new Uint32Array(N * N * 6);
  let ptr = 0;
  for (let iz = 0; iz < N; iz += 1) {
    for (let ix = 0; ix < N; ix += 1) {
      const i00 = iz * (N + 1) + ix;
      const i10 = i00 + 1;
      const i01 = i00 + (N + 1);
      const i11 = i01 + 1;
      indices[ptr++] = i00;
      indices[ptr++] = i01;
      indices[ptr++] = i10;
      indices[ptr++] = i10;
      indices[ptr++] = i01;
      indices[ptr++] = i11;
    }
  }

  return { verts, indices };
}

/** Build Solara Suspension Bridge spanning the strait between Solara Ridge and Lighthouse/Bay Channel. */
function appendSuspensionBridge(arr) {
  const bx0 = -280;
  const bz0 = 490;
  const bx1 = 380;
  const bz1 = 590;
  const dx = bx1 - bx0;
  const dz = bz1 - bz0;
  const len = Math.hypot(dx, dz);
  const yaw = Math.atan2(dx, dz);
  const midX = (bx0 + bx1) * 0.5;
  const midZ = (bz0 + bz1) * 0.5;
  const deckY = 44;

  // Roadway deck & concrete approach piers
  pushBox(arr, 0, deckY, 0, 8.5, 1.4, len * 0.5, C_STEEL, M_MATTE, yaw, midX, 0, midZ, [2, 16]);
  pushBox(arr, 0, deckY + 1.5, 0, 0.45, 0.1, len * 0.48, C_YELLOW, M_MATTE, yaw, midX, 0, midZ);

  // Twin crimson suspension towers + crossbeams
  const towerOffsets = [-len * 0.24, len * 0.24];
  for (const tz of towerOffsets) {
    for (const s of [-1, 1]) {
      pushBox(arr, s * 8.2, 52, tz, 1.9, 52, 2.2, C_RED, M_PAINT, yaw, midX, 0, midZ);
    }
    pushBox(arr, 0, 96, tz, 9.5, 2.0, 2.0, C_RED, M_PAINT, yaw, midX, 0, midZ);
    pushBox(arr, 0, 68, tz, 9.0, 1.6, 1.8, C_RED, M_PAINT, yaw, midX, 0, midZ);
    pushBox(arr, 0, 105.5, tz, 1.2, 1.2, 1.2, C_AMBER_LIT, M_EMISSIVE, yaw, midX, 0, midZ);
  }

  // Parabolic suspension cables & vertical hanger rods + bridge lamps
  const ca = Math.cos(yaw);
  const sa = Math.sin(yaw);
  const toW = (lx, ly, lz) => ({ x: midX + lx * ca + lz * sa, y: ly, z: midZ - lx * sa + lz * ca });
  const segs = 14;
  const t0 = towerOffsets[0];
  const t1 = towerOffsets[1];

  for (let i = 0; i < segs; i += 1) {
    const u0 = i / segs;
    const u1 = (i + 1) / segs;
    const z0 = t0 + (t1 - t0) * u0;
    const z1 = t0 + (t1 - t0) * u1;
    const sag0 = 102 - 48 * (1 - Math.pow(u0 * 2 - 1, 2));
    const sag1 = 102 - 48 * (1 - Math.pow(u1 * 2 - 1, 2));
    for (const s of [-1, 1]) {
      const p0 = toW(s * 8.2, sag0, z0);
      const p1 = toW(s * 8.2, sag1, z1);
      pushVertexQuad(arr, { x: p0.x, y: p0.y - 0.6, z: p0.z }, { x: p1.x, y: p1.y - 0.6, z: p1.z },
        { x: p1.x, y: p1.y + 0.6, z: p1.z }, { x: p0.x, y: p0.y + 0.6, z: p0.z }, C_WHITE, M_METAL, { x: 0, y: 1, z: 0 });
      // Vertical hanger rod every 2 segments
      if (i % 2 === 1) {
        pushBox(arr, s * 8.2, (deckY + sag0) * 0.5, z0, 0.25, (sag0 - deckY) * 0.5, 0.25, C_STEEL, M_METAL, yaw, midX, 0, midZ);
        pushBox(arr, s * 8.0, deckY + 2.8, z0, 0.5, 0.5, 0.5, C_AMBER_LIT, M_EMISSIVE, yaw, midX, 0, midZ);
      }
    }
  }
}

/** Build Solara Harbor Town (villas, warehouses, crane, docks, sailboats) on Solara East Bay. */
function appendHarborVillage(arr, world) {
  const villas = [
    [138, -95, 11, 9, 8, 0.1],
    [168, -68, 12, 10, 9, -0.2],
    [142, -32, 10, 8, 7, 0.3],
    [182, -12, 14, 11, 10, 0.0],
    [152, 42, 11, 9, 8, -0.15],
    [194, 65, 13, 10, 9, 0.25],
    [125, -142, 15, 11, 9, 0.05],
    [206, -110, 12, 9, 8, -0.3],
  ];
  for (let i = 0; i < villas.length; i += 1) {
    const [vx, vz, w, d, h, yaw] = villas[i];
    const vy = Math.max(4, world.getHeight(vx, vz));
    pushBox(arr, 0, h * 0.5, 0, w * 0.5, h * 0.5, d * 0.5, C_CREAM, M_PAINT, yaw, vx, vy, vz);
    pushBox(arr, 0, h + 1.1, 0, w * 0.54, 1.2, d * 0.54, i % 3 === 0 ? C_STEEL : C_TERRACOTTA, M_PAINT, yaw, vx, vy, vz);
    // Warm lit harbor window strip
    pushBox(arr, 0, h * 0.58, d * 0.51, w * 0.32, 1.1, 0.15, C_AMBER_LIT, M_EMISSIVE, yaw, vx, vy, vz);
  }
  // Harbor cargo crane on dock
  pushBox(arr, 0, 14, 0, 2.0, 14, 2.0, C_YELLOW, M_PAINT, 0.2, 245, 2, -125);
  pushBox(arr, 11, 27, 0, 14, 1.4, 1.5, C_YELLOW, M_PAINT, 0.2, 245, 2, -125);

  // Sailboats moored in the bay with crisp white sails
  const boats = [[295, -80, 0.4], [320, -175, -0.3], [275, 20, 0.7], [360, -35, 0.1]];
  for (const [bx, bz, byaw] of boats) {
    pushBox(arr, 0, 1.1, 0, 2.4, 1.0, 7.5, C_WHITE, M_PAINT, byaw, bx, 0, bz);
    pushBox(arr, 0, 10.5, 0.5, 0.25, 9.5, 0.25, C_WOOD, M_MATTE, byaw, bx, 0, bz);
    const ca = Math.cos(byaw);
    const sa = Math.sin(byaw);
    const p = (lx, ly, lz) => ({ x: bx + lx * ca + lz * sa, y: ly, z: bz - lx * sa + lz * ca });
    pushVertexTri(arr, p(0, 3.0, -4.5), p(0, 3.0, 1.0), p(0, 19.0, 0.5), C_WHITE, M_MATTE, { x: 1, y: 0, z: 0 });
  }
}

/** Build static tarmac runway buffers + metallic/painted props/carrier/bridge/village/trees. */
export function buildStaticWorldMeshes(world) {
  const tarmac = [];
  const props = [];

  for (let i = 0; i < world.runways.length; i += 1) {
    const r = world.runways[i];
    const hw = r.width * 0.5;
    const hl = r.length * 0.5;

    if (r.isCarrier) {
      pushBox(props, 0, -11, 0, hw * 0.72, 10.5, hl * 0.94, C_HULL, M_METAL, r.yaw, r.x, r.y, r.z, [2, 8]);
      pushBox(tarmac, 0, -0.4, 0, hw, 0.7, hl, C_DECK, M_MATTE, r.yaw, r.x, r.y, r.z, [2, 10]);
      pushBox(props, hw * 0.72, 7.5, -18, 6.2, 7.5, 22, C_HULL, M_PAINT, r.yaw, r.x, r.y, r.z);
      pushBox(props, hw * 0.72, 13.0, -12, 6.6, 2.2, 10, C_GLASS, M_GLASS, r.yaw, r.x, r.y, r.z);
      pushBox(props, hw * 0.72, 20.5, -22, 1.4, 6.0, 1.4, C_WHITE, M_METAL, r.yaw, r.x, r.y, r.z);
      for (let z = -hl + 24; z <= hl - 24; z += 22) {
        pushBox(props, -2, 0.44, z, 0.75, 0.1, 7, C_WHITE, M_MATTE, r.yaw, r.x, r.y, r.z);
      }
      for (const s of [-1, 1]) {
        pushBox(props, s * (hw - 1.5), 0.44, 0, 0.65, 0.1, hl - 8, C_YELLOW, M_MATTE, r.yaw, r.x, r.y, r.z);
      }
      for (let w = 0; w < 4; w += 1) {
        pushBox(props, -2, 0.54, -hl + 42 + w * 14, hw * 0.55, 0.12, 0.25, C_YELLOW, M_METAL, r.yaw, r.x, r.y, r.z);
      }
      pushBox(props, -hw + 2.5, 3.0, -24, 3.8, 0.6, 0.6, C_GREEN_LIT, M_EMISSIVE, r.yaw, r.x, r.y, r.z);
      pushBox(props, -hw + 2.5, 3.0, -23.3, 1.1, 1.1, 0.7, C_AMBER_LIT, M_EMISSIVE, r.yaw, r.x, r.y, r.z);
      for (let z = -hl + 14; z <= hl - 14; z += 32) {
        pushBox(props, -hw + 0.8, 0.75, z, 0.55, 0.45, 0.55, C_AMBER_LIT, M_EMISSIVE, r.yaw, r.x, r.y, r.z);
        pushBox(props, hw - 0.8, 0.75, z, 0.55, 0.45, 0.55, C_AMBER_LIT, M_EMISSIVE, r.yaw, r.x, r.y, r.z);
      }
      continue;
    }

    // Weathered tarmac runway deck + concrete apron
    pushBox(tarmac, 0, 0.22, 0, hw, 0.35, hl, C_ASPHALT, M_MATTE, r.yaw, r.x, r.y, r.z, [2, 12]);
    if (r.id === 'solara') {
      pushBox(tarmac, -48, 0.15, -88, 30, 0.25, 58, [0.30, 0.33, 0.36, 1], M_MATTE, r.yaw, r.x, r.y, r.z, [2, 4]);
    }
    for (const s of [-1, 1]) {
      pushBox(props, s * (hw - 1.1), 0.60, 0, 0.55, 0.06, hl - 4, C_YELLOW, M_MATTE, r.yaw, r.x, r.y, r.z);
    }
    for (const end of [-1, 1]) {
      const zBase = end * (hl - 20);
      for (let k = -2; k <= 2; k += 1) {
        if (k === 0) continue;
        pushBox(props, k * 3.5, 0.60, zBase, 1.0, 0.06, 11, C_WHITE, M_MATTE, r.yaw, r.x, r.y, r.z);
      }
    }
    for (let z = -hl + 44; z <= hl - 44; z += 32) {
      pushBox(props, 0, 0.60, z, 0.85, 0.06, 8.5, C_WHITE, M_MATTE, r.yaw, r.x, r.y, r.z);
    }
    for (let p = 0; p < 4; p += 1) {
      const col = p < 2 ? C_RED : C_WHITE;
      pushBox(props, hw + 5.5 + p * 4.5, 1.5, -hl + 38, 1.1, 1.1, 1.1, col, M_EMISSIVE, r.yaw, r.x, r.y, r.z);
    }
  }

  for (let i = 0; i < world.landmarks.length; i += 1) {
    const lm = world.landmarks[i];
    if (lm.kind === 'tower') {
      pushBox(props, 0, lm.height * 0.42, 0, 5.5, lm.height * 0.42, 5.5, C_WHITE, M_PAINT, 0, lm.x, lm.y, lm.z);
      pushBox(props, 0, lm.height * 0.9, 0, 8.2, 3.6, 8.2, C_GLASS, M_GLASS, 0, lm.x, lm.y, lm.z);
      pushBox(props, 0, lm.height + 0.8, 0, 8.8, 0.8, 8.8, C_HULL, M_METAL, 0, lm.x, lm.y, lm.z);
    } else if (lm.kind === 'hangar') {
      pushBox(props, 0, lm.height * 0.5, 0, lm.width * 0.5, lm.height * 0.5, lm.depth * 0.5, C_HULL, M_METAL, 0, lm.x, lm.y, lm.z);
      pushBox(props, 0, lm.height + 1.2, 0, lm.width * 0.52, 1.3, lm.depth * 0.52, C_RED, M_PAINT, 0, lm.x, lm.y, lm.z);
    } else if (lm.kind === 'lighthouse') {
      const tiers = 4;
      const th = lm.height / tiers;
      for (let t = 0; t < tiers; t += 1) {
        const rad = 6.2 * (1 - t * 0.13);
        pushBox(props, 0, t * th + th * 0.5, 0, rad, th * 0.5, rad, t % 2 === 1 ? C_RED : C_WHITE, M_PAINT, 0, lm.x, lm.y, lm.z);
      }
      pushBox(props, 0, lm.height + 3.2, 0, 4.6, 3.2, 4.6, C_AMBER_LIT, M_EMISSIVE, 0, lm.x, lm.y, lm.z);
    } else if (lm.kind === 'harbor') {
      pushBox(props, 0, 2.2, 0, 54, 0.7, 7.5, C_WOOD, M_MATTE, lm.yaw, lm.x, lm.y, lm.z);
      pushBox(props, 44, 2.2, 24, 7.5, 0.7, 32, C_WOOD, M_MATTE, lm.yaw, lm.x, lm.y, lm.z);
    } else if (lm.kind === 'turbine') {
      pushBox(props, 0, lm.height * 0.5, 0, 1.6, lm.height * 0.5, 1.6, C_WHITE, M_METAL, 0, lm.x, lm.y, lm.z);
      pushBox(props, 0, lm.height, 0, 2.0, 2.0, 3.8, C_WHITE, M_PAINT, 0, lm.x, lm.y, lm.z);
    } else if (lm.kind === 'relay') {
      pushBox(props, 0, lm.height * 0.5, 0, 4.5, lm.height * 0.5, 4.5, C_HULL, M_METAL, 0, lm.x, lm.y, lm.z);
      pushBox(props, 0, lm.height + 3.5, 0, 2.2, 3.5, 2.2, C_AMBER_LIT, M_EMISSIVE, 0, lm.x, lm.y, lm.z);
    }
  }

  appendSuspensionBridge(props);
  appendHarborVillage(props, world);

  // Caldera glowing lava fissures inside volcanic saddle
  pushBox(props, 0, 114, 0, 24, 1.5, 24, C_MAGMA, M_MAGMA, 0.4, 965, 0, 1620);
  pushBox(props, 28, 116, -24, 14, 1.5, 18, C_AMBER_LIT, M_MAGMA, -0.3, 965, 0, 1620);

  // Pine/palm clusters across islands
  for (let i = 0; i < world.trees.length; i += 1) {
    const t = world.trees[i];
    const col = i % 2 === 0 ? C_PINE_A : C_PINE_B;
    for (let tier = 0; tier < 2; tier += 1) {
      const y0 = t.y + 1.5 + tier * (t.h * 0.36);
      const y1 = y0 + t.h * 0.58;
      const rad = t.r * (1 - tier * 0.28);
      const apex = { x: t.x, y: y1, z: t.z };
      const c0 = { x: t.x - rad, y: y0, z: t.z - rad };
      const c1 = { x: t.x + rad, y: y0, z: t.z - rad };
      const c2 = { x: t.x + rad, y: y0, z: t.z + rad };
      const c3 = { x: t.x - rad, y: y0, z: t.z + rad };
      pushVertexTri(props, c0, c1, apex, col, M_MATTE, { x: 0, y: 0.4, z: -1 });
      pushVertexTri(props, c1, c2, apex, col, M_MATTE, { x: 1, y: 0.4, z: 0 });
      pushVertexTri(props, c2, c3, apex, col, M_MATTE, { x: 0, y: 0.4, z: 1 });
      pushVertexTri(props, c3, c0, apex, col, M_MATTE, { x: -1, y: 0.4, z: 0 });
    }
  }

  return {
    tarmacData: new Float32Array(tarmac),
    propsData: new Float32Array(props),
  };
}
