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
