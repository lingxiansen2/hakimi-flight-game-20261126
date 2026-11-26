// Static GPU geometry builders for terrain mesh, runways, CVN-07 carrier, harbor, lighthouse, and trees.

import { pushVertexQuad, pushVertexTri } from './math3d.js';
import { WORLD_HALF_EXTENT } from './world.js';

const C_ASPHALT = [0.15, 0.17, 0.21, 1];
const C_DECK = [0.18, 0.20, 0.24, 1];
const C_WHITE = [0.95, 0.94, 0.91, 1];
const C_YELLOW = [0.96, 0.77, 0.24, 1];
const C_RED = [0.88, 0.24, 0.21, 1];
const C_GREEN_LIT = [0.22, 0.94, 0.45, 1];
const C_AMBER_LIT = [1.0, 0.72, 0.18, 1];
const C_HULL = [0.28, 0.32, 0.38, 1];
const C_WOOD = [0.46, 0.33, 0.22, 1];
const C_GLASS = [0.35, 0.76, 0.92, 0.9];
const C_PINE_A = [0.13, 0.38, 0.20, 1];
const C_PINE_B = [0.18, 0.45, 0.23, 1];

const M_MATTE = [0.85, 0.04, 0.0];
const M_PAINT = [0.45, 0.15, 0.0];
const M_METAL = [0.30, 0.65, 0.0];
const M_GLASS = [0.10, 0.35, 0.15];
const M_EMISSIVE = [0.25, 0.0, 1.35];

function pushBox(arr, cx, cy, cz, hx, hy, hz, rgba, mat, yaw = 0, ox = 0, oy = 0, oz = 0) {
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
  pushVertexQuad(arr, v[4], v[5], v[6], v[7], rgba, mat, rVec(0, 0, 1));
  pushVertexQuad(arr, v[1], v[0], v[3], v[2], rgba, mat, rVec(0, 0, -1));
  pushVertexQuad(arr, v[3], v[7], v[6], v[2], rgba, mat, rVec(0, 1, 0));
  pushVertexQuad(arr, v[0], v[1], v[5], v[4], rgba, mat, rVec(0, -1, 0));
  pushVertexQuad(arr, v[5], v[1], v[2], v[6], rgba, mat, rVec(1, 0, 0));
  pushVertexQuad(arr, v[0], v[4], v[7], v[3], rgba, mat, rVec(-1, 0, 0));
}

/** Build high-density terrain vertex/index buffers with central-difference smooth normals. */
export function buildStaticTerrainBuffers(world) {
  const N = 200;
  const span = WORLD_HALF_EXTENT * 2;
  const step = span / N;
  const verts = new Float32Array((N + 1) * (N + 1) * 6);
  const eps = 14;

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

/** Build static runways, CVN-07 carrier, harbor pier + boats, lighthouse, towers, hangars, and trees. */
export function buildStaticWorldPropsData(world) {
  const arr = [];

  for (let i = 0; i < world.runways.length; i += 1) {
    const r = world.runways[i];
    const hw = r.width * 0.5;
    const hl = r.length * 0.5;

    if (r.isCarrier) {
      // CVN-07 Solara Aircraft Carrier hull, angled flight deck, island, and optical landing system
      pushBox(arr, 0, -11, 0, hw * 0.72, 10.5, hl * 0.94, C_HULL, M_METAL, r.yaw, r.x, r.y, r.z);
      pushBox(arr, 0, -0.4, 0, hw, 0.7, hl, C_DECK, M_MATTE, r.yaw, r.x, r.y, r.z);
      // Carrier Island superstructure on starboard side
      pushBox(arr, hw * 0.72, 7.5, -18, 6.2, 7.5, 22, C_HULL, M_PAINT, r.yaw, r.x, r.y, r.z);
      pushBox(arr, hw * 0.72, 13.0, -12, 6.6, 2.2, 10, C_GLASS, M_GLASS, r.yaw, r.x, r.y, r.z);
      pushBox(arr, hw * 0.72, 20.5, -22, 1.4, 6.0, 1.4, C_WHITE, M_METAL, r.yaw, r.x, r.y, r.z);
      // Centerline & foul lines + optical meatball lights
      for (let z = -hl + 24; z <= hl - 24; z += 22) {
        pushBox(arr, -2, 0.42, z, 0.7, 0.1, 7, C_WHITE, M_MATTE, r.yaw, r.x, r.y, r.z);
      }
      for (const s of [-1, 1]) {
        pushBox(arr, s * (hw - 1.5), 0.42, 0, 0.6, 0.1, hl - 8, C_YELLOW, M_MATTE, r.yaw, r.x, r.y, r.z);
      }
      // Arrestor wires across aft deck
      for (let w = 0; w < 4; w += 1) {
        pushBox(arr, -2, 0.52, -hl + 42 + w * 14, hw * 0.55, 0.12, 0.25, C_YELLOW, M_METAL, r.yaw, r.x, r.y, r.z);
      }
      // Optical Landing System (green datum + amber meatball) + glowing deck perimeter lights
      pushBox(arr, -hw + 2.5, 3.0, -24, 3.8, 0.6, 0.6, C_GREEN_LIT, M_EMISSIVE, r.yaw, r.x, r.y, r.z);
      pushBox(arr, -hw + 2.5, 3.0, -23.3, 1.1, 1.1, 0.7, C_AMBER_LIT, M_EMISSIVE, r.yaw, r.x, r.y, r.z);
      for (let z = -hl + 14; z <= hl - 14; z += 32) {
        pushBox(arr, -hw + 0.8, 0.75, z, 0.55, 0.45, 0.55, C_AMBER_LIT, M_EMISSIVE, r.yaw, r.x, r.y, r.z);
        pushBox(arr, hw - 0.8, 0.75, z, 0.55, 0.45, 0.55, C_AMBER_LIT, M_EMISSIVE, r.yaw, r.x, r.y, r.z);
      }
      continue;
    }

    // Island paved runway
    pushBox(arr, 0, 0.2, 0, hw, 0.35, hl, C_ASPHALT, M_MATTE, r.yaw, r.x, r.y, r.z);
    for (const s of [-1, 1]) {
      pushBox(arr, s * (hw - 1.1), 0.58, 0, 0.55, 0.06, hl - 4, C_YELLOW, M_MATTE, r.yaw, r.x, r.y, r.z);
    }
    for (const end of [-1, 1]) {
      const zBase = end * (hl - 20);
      for (let k = -2; k <= 2; k += 1) {
        if (k === 0) continue;
        pushBox(arr, k * 3.5, 0.58, zBase, 1.0, 0.06, 11, C_WHITE, M_MATTE, r.yaw, r.x, r.y, r.z);
      }
    }
    for (let z = -hl + 44; z <= hl - 44; z += 32) {
      pushBox(arr, 0, 0.58, z, 0.85, 0.06, 8.5, C_WHITE, M_MATTE, r.yaw, r.x, r.y, r.z);
    }
    // PAPI glide-slope lights
    for (let p = 0; p < 4; p += 1) {
      const col = p < 2 ? C_RED : C_WHITE;
      pushBox(arr, hw + 5.5 + p * 4.5, 1.5, -hl + 38, 1.1, 1.1, 1.1, col, M_EMISSIVE, r.yaw, r.x, r.y, r.z);
    }
  }

  for (let i = 0; i < world.landmarks.length; i += 1) {
    const lm = world.landmarks[i];
    if (lm.kind === 'tower') {
      pushBox(arr, 0, lm.height * 0.42, 0, 5.5, lm.height * 0.42, 5.5, C_WHITE, M_PAINT, 0, lm.x, lm.y, lm.z);
      pushBox(arr, 0, lm.height * 0.9, 0, 8.2, 3.6, 8.2, C_GLASS, M_GLASS, 0, lm.x, lm.y, lm.z);
      pushBox(arr, 0, lm.height + 0.8, 0, 8.8, 0.8, 8.8, C_HULL, M_METAL, 0, lm.x, lm.y, lm.z);
    } else if (lm.kind === 'hangar') {
      pushBox(arr, 0, lm.height * 0.5, 0, lm.width * 0.5, lm.height * 0.5, lm.depth * 0.5, C_HULL, M_METAL, 0, lm.x, lm.y, lm.z);
      pushBox(arr, 0, lm.height + 1.2, 0, lm.width * 0.52, 1.3, lm.depth * 0.52, C_RED, M_PAINT, 0, lm.x, lm.y, lm.z);
    } else if (lm.kind === 'lighthouse') {
      const tiers = 4;
      const th = lm.height / tiers;
      for (let t = 0; t < tiers; t += 1) {
        const rad = 6.2 * (1 - t * 0.13);
        pushBox(arr, 0, t * th + th * 0.5, 0, rad, th * 0.5, rad, t % 2 === 1 ? C_RED : C_WHITE, M_PAINT, 0, lm.x, lm.y, lm.z);
      }
      pushBox(arr, 0, lm.height + 3.2, 0, 4.6, 3.2, 4.6, C_AMBER_LIT, M_EMISSIVE, 0, lm.x, lm.y, lm.z);
    } else if (lm.kind === 'harbor') {
      // Pier deck + pilings + 3 moored coastal boats
      pushBox(arr, 0, 2.2, 0, 52, 0.7, 7.5, C_WOOD, M_MATTE, lm.yaw, lm.x, lm.y, lm.z);
      pushBox(arr, 42, 2.2, 22, 7.5, 0.7, 30, C_WOOD, M_MATTE, lm.yaw, lm.x, lm.y, lm.z);
      for (let b = 0; b < 3; b += 1) {
        const bx = 18 + b * 24;
        const bz = -16;
        pushBox(arr, bx, 1.4, bz, 3.2, 1.2, 9.5, b === 1 ? C_RED : C_WHITE, M_PAINT, lm.yaw, lm.x, lm.y, lm.z);
        pushBox(arr, bx, 3.2, bz - 1, 2.0, 1.0, 3.4, C_GLASS, M_GLASS, lm.yaw, lm.x, lm.y, lm.z);
      }
    } else if (lm.kind === 'turbine') {
      pushBox(arr, 0, lm.height * 0.5, 0, 1.6, lm.height * 0.5, 1.6, C_WHITE, M_METAL, 0, lm.x, lm.y, lm.z);
      pushBox(arr, 0, lm.height, 0, 2.0, 2.0, 3.8, C_WHITE, M_PAINT, 0, lm.x, lm.y, lm.z);
    } else if (lm.kind === 'relay') {
      pushBox(arr, 0, lm.height * 0.5, 0, 4.5, lm.height * 0.5, 4.5, C_HULL, M_METAL, 0, lm.x, lm.y, lm.z);
      pushBox(arr, 0, lm.height + 3.5, 0, 2.2, 3.5, 2.2, C_AMBER_LIT, M_EMISSIVE, 0, lm.x, lm.y, lm.z);
    }
  }

  // Low-poly layered pine/palm clusters across islands
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
      pushVertexTri(arr, c0, c1, apex, col, M_MATTE, { x: 0, y: 0.4, z: -1 });
      pushVertexTri(arr, c1, c2, apex, col, M_MATTE, { x: 1, y: 0.4, z: 0 });
      pushVertexTri(arr, c2, c3, apex, col, M_MATTE, { x: 0, y: 0.4, z: 1 });
      pushVertexTri(arr, c3, c0, apex, col, M_MATTE, { x: -1, y: 0.4, z: 0 });
    }
  }

  return new Float32Array(arr);
}
