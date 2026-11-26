// 3D math utilities, flight orientation basis, near-plane clipping, and color shading.

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function wrapAngle(rad) {
  let a = rad % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function dot3(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function sub3(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function add3(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function scale3(v, s) {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export function cross3(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function norm3(v) {
  const len = Math.hypot(v.x, v.y, v.z);
  if (len < 1e-8) return { x: 0, y: 0, z: 1 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

/**
 * Compute orthonormal body frame (right, up, forward) from yaw, pitch, roll.
 * World convention: +X East, +Y Up, +Z North; yaw=0 faces +Z, +yaw turns clockwise toward +X.
 */
export function buildBasis(yaw, pitch, roll) {
  const sy = Math.sin(yaw);
  const cy = Math.cos(yaw);
  const sp = Math.sin(pitch);
  const cp = Math.cos(pitch);
  const sr = Math.sin(roll);
  const cr = Math.cos(roll);

  const f0 = { x: sy, y: 0, z: cy };
  const r0 = { x: cy, y: 0, z: -sy };
  const u0 = { x: 0, y: 1, z: 0 };

  const forward = {
    x: f0.x * cp + u0.x * sp,
    y: f0.y * cp + u0.y * sp,
    z: f0.z * cp + u0.z * sp,
  };
  const u1 = {
    x: -f0.x * sp + u0.x * cp,
    y: -f0.y * sp + u0.y * cp,
    z: -f0.z * sp + u0.z * cp,
  };

  const right = {
    x: r0.x * cr - u1.x * sr,
    y: r0.y * cr - u1.y * sr,
    z: r0.z * cr - u1.z * sr,
  };
  const up = {
    x: r0.x * sr + u1.x * cr,
    y: r0.y * sr + u1.y * cr,
    z: r0.z * sr + u1.z * cr,
  };

  return { right, up, forward };
}

/** Transform a local body-space point into world coordinates. */
export function localToWorld(local, origin, basis) {
  return {
    x: origin.x + basis.right.x * local.x + basis.up.x * local.y + basis.forward.x * local.z,
    y: origin.y + basis.right.y * local.x + basis.up.y * local.y + basis.forward.y * local.z,
    z: origin.z + basis.right.z * local.x + basis.up.z * local.y + basis.forward.z * local.z,
  };
}

/** Transform a world point into camera space (vx right, vy up, vz forward). */
export function worldToCamera(p, camPos, camBasis) {
  const dx = p.x - camPos.x;
  const dy = p.y - camPos.y;
  const dz = p.z - camPos.z;
  return {
    x: dx * camBasis.right.x + dy * camBasis.right.y + dz * camBasis.right.z,
    y: dx * camBasis.up.x + dy * camBasis.up.y + dz * camBasis.up.z,
    z: dx * camBasis.forward.x + dy * camBasis.forward.y + dz * camBasis.forward.z,
  };
}

/** Clip a convex polygon in camera space against z >= nearZ. */
export function clipPolygonNear(pts, nearZ) {
  const out = [];
  const count = pts.length;
  if (count < 3) return out;
  for (let i = 0; i < count; i += 1) {
    const a = pts[i];
    const b = pts[(i + 1) % count];
    const aIn = a.z >= nearZ;
    const bIn = b.z >= nearZ;
    if (aIn && bIn) {
      out.push(b);
    } else if (aIn && !bIn) {
      const t = (nearZ - a.z) / (b.z - a.z);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: nearZ });
    } else if (!aIn && bIn) {
      const t = (nearZ - a.z) / (b.z - a.z);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: nearZ });
      out.push(b);
    }
  }
  return out;
}

export function hexToRgb(hex) {
  const clean = hex.startsWith('#') ? hex.slice(1) : hex;
  const num = Number.parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function shadeAndFogColor(baseRgb, shade, fogRgb, fogAmount) {
  const f = clamp(fogAmount, 0, 1);
  const r = Math.round(clamp(baseRgb[0] * shade, 0, 255) * (1 - f) + fogRgb[0] * f);
  const g = Math.round(clamp(baseRgb[1] * shade, 0, 255) * (1 - f) + fogRgb[1] * f);
  const b = Math.round(clamp(baseRgb[2] * shade, 0, 255) * (1 - f) + fogRgb[2] * f);
  return `rgb(${r},${g},${b})`;
}

export function mat4Identity() {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
}

export function mat4Perspective(fovYRad, aspect, near, far) {
  const f = 1 / Math.tan(fovYRad * 0.5);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

export function mat4View(camPos, camBasis) {
  const { right: r, up: u, forward: f } = camBasis;
  return new Float32Array([
    r.x, u.x, -f.x, 0,
    r.y, u.y, -f.y, 0,
    r.z, u.z, -f.z, 0,
    -(r.x * camPos.x + r.y * camPos.y + r.z * camPos.z),
    -(u.x * camPos.x + u.y * camPos.y + u.z * camPos.z),
    f.x * camPos.x + f.y * camPos.y + f.z * camPos.z,
    1,
  ]);
}

export function mat4FromBasisPos(basis, pos) {
  const { right: r, up: u, forward: f } = basis;
  return new Float32Array([
    r.x, r.y, r.z, 0,
    u.x, u.y, u.z, 0,
    f.x, f.y, f.z, 0,
    pos.x, pos.y, pos.z, 1,
  ]);
}

export function mat4Multiply(a, b) {
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col += 1) {
    const b0 = b[col * 4];
    const b1 = b[col * 4 + 1];
    const b2 = b[col * 4 + 2];
    const b3 = b[col * 4 + 3];
    out[col * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
    out[col * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
    out[col * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
    out[col * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
  }
  return out;
}

/** Append one triangle (3 * 13 floats) with outward normal verification. */
export function pushVertexTri(arr, p0, p1, p2, rgba, mat, outwardHint = null) {
  const e1x = p1.x - p0.x;
  const e1y = p1.y - p0.y;
  const e1z = p1.z - p0.z;
  const e2x = p2.x - p0.x;
  const e2y = p2.y - p0.y;
  const e2z = p2.z - p0.z;
  let nx = e1y * e2z - e1z * e2y;
  let ny = e1z * e2x - e1x * e2z;
  let nz = e1x * e2y - e1y * e2x;
  let v1 = p1;
  let v2 = p2;
  if (outwardHint && nx * outwardHint.x + ny * outwardHint.y + nz * outwardHint.z < 0) {
    nx = -nx;
    ny = -ny;
    nz = -nz;
    v1 = p2;
    v2 = p1;
  }
  const len = Math.hypot(nx, ny, nz) || 1;
  nx /= len;
  ny /= len;
  nz /= len;
  const pts = [p0, v1, v2];
  for (let i = 0; i < 3; i += 1) {
    const p = pts[i];
    arr.push(p.x, p.y, p.z, nx, ny, nz, rgba[0], rgba[1], rgba[2], rgba[3] ?? 1, mat[0], mat[1], mat[2]);
  }
}

export function pushVertexQuad(arr, a, b, c, d, rgba, mat, outwardHint = null) {
  pushVertexTri(arr, a, b, c, rgba, mat, outwardHint);
  pushVertexTri(arr, a, c, d, rgba, mat, outwardHint);
}
