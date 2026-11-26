// Custom Canvas2D 3D atmospheric renderer: sky dome, ocean glint, terrain mesh, runways, rings, clouds, and aircraft.

import { VIEWPORT } from './config.js';
import {
  buildBasis,
  clamp,
  clipPolygonNear,
  cross3,
  dot3,
  hexToRgb,
  norm3,
  shadeAndFogColor,
  sub3,
  worldToCamera,
} from './math3d.js';
import { classifySurfaceRgb } from './world.js';
import { buildAircraftPolygons } from './aircraft.js';

const THEMES = {
  day: {
    zenith: '#0e3264',
    mid: '#3578b8',
    horizon: '#d8e9f2',
    oceanFar: '#12537a',
    oceanNear: '#0b3859',
    fogRgb: [204, 226, 240],
    sunDir: norm3({ x: 0.52, y: 0.58, z: 0.62 }),
    sunColor: '#fff6d6',
    cloudTop: [252, 251, 248],
    cloudBottom: [188, 204, 224],
  },
  golden: {
    zenith: '#162850',
    mid: '#4d618f',
    horizon: '#f5b878',
    oceanFar: '#1e4a6d',
    oceanNear: '#0e2d49',
    fogRgb: [238, 185, 134],
    sunDir: norm3({ x: -0.45, y: 0.28, z: 0.85 }),
    sunColor: '#ffe09a',
    cloudTop: [255, 232, 198],
    cloudBottom: [158, 138, 165],
  },
  sunset: {
    zenith: '#1a1f47',
    mid: '#6c4876',
    horizon: '#f58b60',
    oceanFar: '#273a62',
    oceanNear: '#12213d',
    fogRgb: [232, 146, 114],
    sunDir: norm3({ x: 0.62, y: 0.22, z: 0.75 }),
    sunColor: '#ffbe78',
    cloudTop: [255, 206, 175],
    cloudBottom: [132, 108, 145],
  },
};

const C_ASPHALT = hexToRgb('#2a3038');
const C_WHITE = [245, 244, 238];
const C_YELLOW = [245, 196, 66];
const C_RED = [228, 64, 58];
const C_TOWER = [226, 232, 240];
const C_TOWER_GLASS = [96, 208, 242];
const C_HANGAR = [92, 114, 134];

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function getFocalLength(fovDeg) {
    return (VIEWPORT.height * 0.5) / Math.tan(((fovDeg * 0.5) * Math.PI) / 180);
  }

  function projectCamPoint(p, focal) {
    const cx = VIEWPORT.width * 0.5;
    const cy = VIEWPORT.height * 0.5;
    const invZ = focal / p.z;
    return {
      x: cx + p.x * invZ,
      y: cy - p.y * invZ,
      z: p.z,
    };
  }

  function worldPointToScreen(wp, cam, focal) {
    const cp = worldToCamera(wp, cam.pos, cam.basis);
    if (cp.z <= VIEWPORT.nearZ) return null;
    return projectCamPoint(cp, focal);
  }

  /** Draw tilted sky & ocean background aligned accurately with camera orientation. */
  function drawSkyAndOcean(cam, theme, focal, simTime) {
    const w = VIEWPORT.width;
    const h = VIEWPORT.height;
    const cx = w * 0.5;
    const cy = h * 0.5;

    // Horizon line orientation in camera space
    const fwd = cam.basis.forward;
    const pitchSin = clamp(-fwd.y, -0.95, 0.95);
    const horizonOffset = (pitchSin / Math.max(0.25, Math.sqrt(1 - pitchSin * pitchSin))) * focal;
    const rollAngle = Math.atan2(cam.basis.right.y, cam.basis.up.y);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rollAngle);

    const span = 1800;
    const skyGrad = ctx.createLinearGradient(0, -900, 0, horizonOffset);
    skyGrad.addColorStop(0, theme.zenith);
    skyGrad.addColorStop(0.58, theme.mid);
    skyGrad.addColorStop(1, theme.horizon);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(-span, -span, span * 2, span + horizonOffset + 4);

    const seaGrad = ctx.createLinearGradient(0, horizonOffset, 0, 900);
    seaGrad.addColorStop(0, theme.horizon);
    seaGrad.addColorStop(0.06, theme.oceanFar);
    seaGrad.addColorStop(0.65, theme.oceanNear);
    seaGrad.addColorStop(1, '#07243b');
    ctx.fillStyle = seaGrad;
    ctx.fillRect(-span, horizonOffset - 2, span * 2, span);

    // Subtle horizon atmospheric shimmer lines
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-span, horizonOffset);
    ctx.lineTo(span, horizonOffset);
    ctx.stroke();

    ctx.restore();

    // Sun disc + corona + water specular glint column
    const sunCam = {
      x: dot3(theme.sunDir, cam.basis.right),
      y: dot3(theme.sunDir, cam.basis.up),
      z: dot3(theme.sunDir, cam.basis.forward),
    };
    if (sunCam.z > 0.08) {
      const sx = cx + (sunCam.x / sunCam.z) * focal;
      const sy = cy - (sunCam.y / sunCam.z) * focal;
      const halo = ctx.createRadialGradient(sx, sy, 8, sx, sy, 145);
      halo.addColorStop(0, theme.sunColor);
      halo.addColorStop(0.25, 'rgba(255, 232, 165, 0.45)');
      halo.addColorStop(1, 'rgba(255, 220, 150, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(sx, sy, 145, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fffdf0';
      ctx.beginPath();
      ctx.arc(sx, sy, 20, 0, Math.PI * 2);
      ctx.fill();

      // Sun glint ripples on ocean below horizon
      ctx.save();
      ctx.fillStyle = 'rgba(255, 240, 195, 0.22)';
      for (let i = 0; i < 11; i += 1) {
        const gy = sy + 90 + i * 36;
        if (gy > h) break;
        const wobble = Math.sin(simTime * 2.2 + i * 1.4) * 14;
        const gw = 16 + i * 9;
        ctx.fillRect(sx - gw * 0.5 + wobble, gy, gw, 2.5);
      }
      ctx.restore();
    }
  }

  /** Push a 3D polygon into the depth-sorted render queue after near-plane clipping. */
  function queuePoly(queue, pts, rgb, cam, theme, opts = {}) {
    const camPts = new Array(pts.length);
    let minZ = Infinity;
    let maxZ = -Infinity;
    let sumX = 0;
    let sumY = 0;
    let sumZ = 0;

    for (let i = 0; i < pts.length; i += 1) {
      const cp = worldToCamera(pts[i], cam.pos, cam.basis);
      camPts[i] = cp;
      if (cp.z < minZ) minZ = cp.z;
      if (cp.z > maxZ) maxZ = cp.z;
      sumX += cp.x;
      sumY += cp.y;
      sumZ += cp.z;
    }

    if (maxZ <= VIEWPORT.nearZ || minZ > VIEWPORT.farZ) return;

    // Quick frustum cull on X/Y cone
    const invN = 1 / Math.max(1, camPts.length);
    const avgZ = sumZ * invN;
    if (avgZ > 10 && Math.abs(sumX * invN) > avgZ * 1.45 && Math.abs(sumY * invN) > avgZ * 1.1) return;

    const clipped = minZ < VIEWPORT.nearZ ? clipPolygonNear(camPts, VIEWPORT.nearZ) : camPts;
    if (clipped.length < 3) return;

    // Normal shading in world space
    const e1 = sub3(pts[1], pts[0]);
    const e2 = sub3(pts[2], pts[0]);
    const normal = norm3(cross3(e2, e1));
    const nDotSun = dot3(normal, theme.sunDir);
    const sunTerm = opts.doubleSided ? Math.abs(nDotSun) : Math.max(0, nDotSun);
    const shade = opts.unlit ? 1.0 : (0.46 + 0.62 * sunTerm);
    const fogAmount = opts.noFog ? 0 : Math.pow(clamp((avgZ - 320) / (VIEWPORT.farZ - 320), 0, 1), 1.35);
    const color = opts.overrideColor ?? shadeAndFogColor(rgb, shade, theme.fogRgb, fogAmount);

    queue.push({
      camPts: clipped,
      depth: avgZ + (opts.depthBias ?? 0),
      color,
      stroke: opts.stroke ?? (opts.matchStroke ? color : null),
      lineWidth: opts.lineWidth ?? (opts.matchStroke ? 0.9 : 1),
      alpha: opts.alpha ?? 1,
    });
  }

  /** Build terrain mesh tiles around the camera with adaptive grid resolution. */
  function queueTerrain(queue, world, cam, theme, simTime) {
    const step = 130;
    const radius = 2470;
    const baseGx = Math.floor(cam.pos.x / step) * step;
    const baseGz = Math.floor(cam.pos.z / step) * step;
    const cols = Math.floor((radius * 2) / step);

    // Sample grid vertices once
    const heights = new Float32Array((cols + 1) * (cols + 1));
    for (let iz = 0; iz <= cols; iz += 1) {
      const wz = baseGz - radius + iz * step;
      for (let ix = 0; ix <= cols; ix += 1) {
        const wx = baseGx - radius + ix * step;
        heights[iz * (cols + 1) + ix] = world.getHeight(wx, wz);
      }
    }

    const fwd = cam.basis.forward;
    for (let iz = 0; iz < cols; iz += 1) {
      const wz0 = baseGz - radius + iz * step;
      const wz1 = wz0 + step;
      for (let ix = 0; ix < cols; ix += 1) {
        const wx0 = baseGx - radius + ix * step;
        const wx1 = wx0 + step;
        const h00 = heights[iz * (cols + 1) + ix];
        const h10 = heights[iz * (cols + 1) + ix + 1];
        const h01 = heights[(iz + 1) * (cols + 1) + ix];
        const h11 = heights[(iz + 1) * (cols + 1) + ix + 1];

        // Skip pure ocean tiles so island shores meet the smooth sea horizon cleanly
        const maxH = Math.max(h00, h10, h01, h11);
        const minH = Math.min(h00, h10, h01, h11);
        if (maxH <= 0.25) continue;

        const dx = wx0 + step * 0.5 - cam.pos.x;
        const dz = wz0 + step * 0.5 - cam.pos.z;
        if (dx * fwd.x + dz * fwd.z < -step * 2.2) continue;

        const y00 = Math.max(0, h00);
        const y10 = Math.max(0, h10);
        const y01 = Math.max(0, h01);
        const y11 = Math.max(0, h11);

        const p00 = { x: wx0, y: y00, z: wz0 };
        const p10 = { x: wx1, y: y10, z: wz0 };
        const p11 = { x: wx1, y: y11, z: wz1 };
        const p01 = { x: wx0, y: y01, z: wz1 };

        // Split quad into 2 shaded triangles; sandy shoreline where island meets ocean
        const avgA = (y00 + y10 + y11) / 3;
        const nA = norm3(cross3(sub3(p11, p00), sub3(p10, p00)));
        const rgbA = minH < 0 && maxH < 9 ? [224, 204, 164] : classifySurfaceRgb(avgA, nA.y);
        queuePoly(queue, [p00, p10, p11], rgbA, cam, theme, { matchStroke: true });

        const avgB = (y00 + y11 + y01) / 3;
        const nB = norm3(cross3(sub3(p01, p00), sub3(p11, p00)));
        const rgbB = minH < 0 && maxH < 9 ? [224, 204, 164] : classifySurfaceRgb(avgB, nB.y);
        queuePoly(queue, [p00, p11, p01], rgbB, cam, theme, { matchStroke: true });
      }
    }
  }

  /** Queue 3D runways with painted threshold stripes, centerline dashes, and PAPI lights. */
  function queueRunways(queue, runways, cam, theme, simTime) {
    for (let i = 0; i < runways.length; i += 1) {
      const r = runways[i];
      if (Math.hypot(r.x - cam.pos.x, r.z - cam.pos.z) > 2800) continue;
      const ca = Math.cos(r.yaw);
      const sa = Math.sin(r.yaw);
      const toWorld = (across, along, dy = 0.5) => ({
        x: r.x + across * ca + along * sa,
        y: r.y + dy,
        z: r.z - across * sa + along * ca,
      });

      const hw = r.width * 0.5;
      const hl = r.length * 0.5;
      // Asphalt deck
      queuePoly(queue, [
        toWorld(-hw, -hl, 0.4),
        toWorld(hw, -hl, 0.4),
        toWorld(hw, hl, 0.4),
        toWorld(-hw, hl, 0.4),
      ], C_ASPHALT, cam, theme, { unlit: true, depthBias: -14 });

      // Side yellow shoulders
      for (const s of [-1, 1]) {
        queuePoly(queue, [
          toWorld(s * (hw - 1.6), -hl + 6, 0.55),
          toWorld(s * (hw - 0.5), -hl + 6, 0.55),
          toWorld(s * (hw - 0.5), hl - 6, 0.55),
          toWorld(s * (hw - 1.6), hl - 6, 0.55),
        ], C_YELLOW, cam, theme, { unlit: true, depthBias: -15 });
      }

      // Threshold piano keys at both ends
      for (const end of [-1, 1]) {
        const zBase = end * (hl - 22);
        for (let k = -2; k <= 2; k += 1) {
          if (k === 0) continue;
          const xOff = k * 3.4;
          queuePoly(queue, [
            toWorld(xOff - 1.1, zBase - 12, 0.6),
            toWorld(xOff + 1.1, zBase - 12, 0.6),
            toWorld(xOff + 1.1, zBase + 12, 0.6),
            toWorld(xOff - 1.1, zBase + 12, 0.6),
          ], C_WHITE, cam, theme, { unlit: true, depthBias: -16 });
        }
      }

      // Centerline dashes
      for (let z = -hl + 48; z <= hl - 48; z += 36) {
        queuePoly(queue, [
          toWorld(-0.9, z - 9, 0.6),
          toWorld(0.9, z - 9, 0.6),
          toWorld(0.9, z + 9, 0.6),
          toWorld(-0.9, z + 9, 0.6),
        ], C_WHITE, cam, theme, { unlit: true, depthBias: -16 });
      }

      // PAPI glide-slope light boxes beside south & north thresholds
      const pulse = 0.8 + 0.2 * Math.sin(simTime * 5);
      for (let p = 0; p < 4; p += 1) {
        const papiRgb = p < 2 ? [Math.round(250 * pulse), 68, 62] : [255, 250, 235];
        const px = hw + 6 + p * 4.5;
        queuePoly(queue, [
          toWorld(px - 1.3, -hl + 35, 1.8),
          toWorld(px + 1.3, -hl + 35, 1.8),
          toWorld(px + 1.3, -hl + 35, 4.2),
          toWorld(px - 1.3, -hl + 35, 4.2),
        ], papiRgb, cam, theme, { unlit: true, doubleSided: true, depthBias: -16 });
      }
    }
  }

  /** Queue 3D coastal landmarks: air traffic tower, hangars, striped lighthouse, wind turbines. */
  function queueLandmarks(queue, landmarks, cam, theme, simTime) {
    for (let i = 0; i < landmarks.length; i += 1) {
      const lm = landmarks[i];
      if (Math.hypot(lm.x - cam.pos.x, lm.z - cam.pos.z) > 2900) continue;

      if (lm.kind === 'tower' || lm.kind === 'lighthouse' || lm.kind === 'relay') {
        const w = lm.kind === 'lighthouse' ? 6.5 : 7.5;
        const h = lm.height;
        const tiers = lm.kind === 'lighthouse' ? 3 : 2;
        const tierH = h / tiers;
        for (let t = 0; t < tiers; t += 1) {
          const y0 = lm.y + t * tierH;
          const y1 = y0 + tierH;
          const r0 = w * (1 - t * 0.14);
          const r1 = w * (1 - (t + 1) * 0.14);
          const rgb = lm.kind === 'lighthouse' && t % 2 === 1 ? C_RED : C_TOWER;
          const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
          for (let c = 0; c < 4; c += 1) {
            const [ax, az] = corners[c];
            const [bx, bz] = corners[(c + 1) % 4];
            queuePoly(queue, [
              { x: lm.x + ax * r0, y: y0, z: lm.z + az * r0 },
              { x: lm.x + bx * r0, y: y0, z: lm.z + bz * r0 },
              { x: lm.x + bx * r1, y: y1, z: lm.z + bz * r1 },
              { x: lm.x + ax * r1, y: y1, z: lm.z + az * r1 },
            ], rgb, cam, theme);
          }
        }
        // Top glass cab / glowing beacon
        const topY = lm.y + h;
        const cabRgb = lm.kind === 'lighthouse'
          ? (Math.sin(simTime * 4) > 0 ? [255, 224, 92] : [255, 168, 52])
          : C_TOWER_GLASS;
        const cw = lm.kind === 'tower' ? 9.5 : 6.2;
        const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
        for (let c = 0; c < 4; c += 1) {
          const [ax, az] = corners[c];
          const [bx, bz] = corners[(c + 1) % 4];
          queuePoly(queue, [
            { x: lm.x + ax * cw, y: topY, z: lm.z + az * cw },
            { x: lm.x + bx * cw, y: topY, z: lm.z + bz * cw },
            { x: lm.x + bx * cw, y: topY + 6.5, z: lm.z + bz * cw },
            { x: lm.x + ax * cw, y: topY + 6.5, z: lm.z + az * cw },
          ], cabRgb, cam, theme, { unlit: lm.kind === 'lighthouse' });
        }
      } else if (lm.kind === 'hangar') {
        const hw = lm.width * 0.5;
        const hd = lm.depth * 0.5;
        const y0 = lm.y;
        const y1 = lm.y + lm.height;
        const corners = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
        for (let c = 0; c < 4; c += 1) {
          const [ax, az] = corners[c];
          const [bx, bz] = corners[(c + 1) % 4];
          queuePoly(queue, [
            { x: lm.x + ax, y: y0, z: lm.z + az },
            { x: lm.x + bx, y: y0, z: lm.z + bz },
            { x: lm.x + bx, y: y1, z: lm.z + bz },
            { x: lm.x + ax, y: y1, z: lm.z + az },
          ], C_HANGAR, cam, theme);
        }
        queuePoly(queue, [
          { x: lm.x - hw, y: y1, z: lm.z - hd },
          { x: lm.x + hw, y: y1, z: lm.z - hd },
          { x: lm.x + hw, y: y1, z: lm.z + hd },
          { x: lm.x - hw, y: y1, z: lm.z + hd },
        ], C_RED, cam, theme);
      } else if (lm.kind === 'turbine') {
        const y0 = lm.y;
        const y1 = lm.y + lm.height;
        queuePoly(queue, [
          { x: lm.x - 2.2, y: y0, z: lm.z },
          { x: lm.x + 2.2, y: y0, z: lm.z },
          { x: lm.x + 1.2, y: y1, z: lm.z },
          { x: lm.x - 1.2, y: y1, z: lm.z },
        ], C_WHITE, cam, theme, { doubleSided: true });
        for (let b = 0; b < 3; b += 1) {
          const ang = simTime * 1.9 + lm.phase + (b * Math.PI * 2) / 3;
          const bx = Math.cos(ang) * 24;
          const by = Math.sin(ang) * 24;
          const px = -Math.sin(ang) * 1.4;
          const py = Math.cos(ang) * 1.4;
          queuePoly(queue, [
            { x: lm.x - px, y: y1 - py, z: lm.z - 2 },
            { x: lm.x + px, y: y1 + py, z: lm.z - 2 },
            { x: lm.x + bx, y: y1 + by, z: lm.z - 2 },
          ], C_WHITE, cam, theme, { doubleSided: true });
        }
      }
    }
  }

  /** Queue layered volumetric 3D clouds with full pyramid/box volume. */
  function queueClouds(queue, clouds, cam, theme, simTime) {
    for (let i = 0; i < clouds.length; i += 1) {
      const c = clouds[i];
      const driftX = ((c.x + simTime * 4.5 + 4200) % 8400) - 4200;
      if (Math.hypot(driftX - cam.pos.x, c.z - cam.pos.z) > 3200) continue;
      for (let j = 0; j < c.puffs.length; j += 1) {
        const p = c.puffs[j];
        const px = driftX + p.ox;
        const py = c.y + p.oy;
        const pz = c.z + p.oz;
        const apex = { x: px, y: py + p.ry, z: pz };
        const base = [
          { x: px - p.rx, y: py, z: pz - p.rz },
          { x: px + p.rx, y: py, z: pz - p.rz },
          { x: px + p.rx, y: py, z: pz + p.rz },
          { x: px - p.rx, y: py, z: pz + p.rz },
        ];
        for (let k = 0; k < 4; k += 1) {
          queuePoly(queue, [base[k], base[(k + 1) % 4], apex], theme.cloudTop, cam, theme, {
            doubleSided: true,
            alpha: 0.88,
            matchStroke: true,
          });
        }
        queuePoly(queue, base, theme.cloudBottom, cam, theme, {
          doubleSided: true,
          alpha: 0.84,
          unlit: true,
          matchStroke: true,
        });
      }
    }
  }

  /** Queue low-poly coastal trees on islands for scale and motion sense. */
  function queueTrees(queue, trees, cam, theme) {
    for (let i = 0; i < trees.length; i += 1) {
      const t = trees[i];
      if (Math.hypot(t.x - cam.pos.x, t.z - cam.pos.z) > 1550) continue;
      const apex = { x: t.x, y: t.y + t.h, z: t.z };
      const b0 = { x: t.x - t.r, y: t.y + 1.5, z: t.z - t.r };
      const b1 = { x: t.x + t.r, y: t.y + 1.5, z: t.z - t.r };
      const b2 = { x: t.x, y: t.y + 1.5, z: t.z + t.r * 1.15 };
      const treeRgb = i % 2 === 0 ? [42, 118, 66] : [56, 134, 72];
      queuePoly(queue, [b0, b1, apex], treeRgb, cam, theme, { doubleSided: true });
      queuePoly(queue, [b1, b2, apex], treeRgb, cam, theme, { doubleSided: true });
      queuePoly(queue, [b2, b0, apex], treeRgb, cam, theme, { doubleSided: true });
    }
  }

  /** Queue 3D glowing checkpoint rings along the mission route. */
  function queueMissionGates(queue, missionState, cam, theme, simTime) {
    const gates = missionState.gates;
    for (let i = 0; i < gates.length; i += 1) {
      const g = gates[i];
      if (g.cleared) continue;
      const isNext = i === missionState.currentGateIndex;
      if (Math.hypot(g.x - cam.pos.x, g.z - cam.pos.z) > 3200) continue;

      const pulse = isNext ? 1 + 0.06 * Math.sin(simTime * 6) : 1;
      const rOuter = g.radius * pulse;
      const rInner = rOuter * 0.82;
      const nextGate = gates[i + 1];
      let ringYaw = 0;
      if (nextGate) {
        ringYaw = Math.atan2(nextGate.x - g.x, nextGate.z - g.z);
      }
      const ca = Math.cos(ringYaw);
      const sa = Math.sin(ringYaw);

      const segs = 12;
      const ringRgb = isNext ? [64, 245, 224] : [140, 195, 230];
      const accentRgb = isNext ? [255, 212, 72] : [110, 155, 195];

      for (let s = 0; s < segs; s += 1) {
        const a0 = (s / segs) * Math.PI * 2 + simTime * (isNext ? 0.45 : 0.1);
        const a1 = ((s + 1) / segs) * Math.PI * 2 + simTime * (isNext ? 0.45 : 0.1);
        const pt = (rad, ang) => {
          const lx = Math.cos(ang) * rad;
          const ly = Math.sin(ang) * rad;
          return { x: g.x + lx * ca, y: g.y + ly, z: g.z - lx * sa };
        };
        queuePoly(queue, [
          pt(rInner, a0),
          pt(rOuter, a0),
          pt(rOuter, a1),
          pt(rInner, a1),
        ], s % 3 === 0 ? accentRgb : ringRgb, cam, theme, {
          unlit: true,
          doubleSided: true,
          alpha: isNext ? 0.92 : 0.48,
          noFog: isNext,
          depthBias: -8,
        });
      }
    }
  }

  /** Draw soft translucent propeller blur disc and wingtip contrail ribbons. */
  function drawAirEffects(ac, cam, focal) {
    // Wingtip contrails
    if (ac.contrails.length > 1) {
      ctx.save();
      ctx.lineWidth = 2.5;
      for (const tipKey of ['left', 'right']) {
        for (let i = 1; i < ac.contrails.length; i += 1) {
          const a = ac.contrails[i - 1];
          const b = ac.contrails[i];
          const sa = worldPointToScreen(a[tipKey], cam, focal);
          const sb = worldPointToScreen(b[tipKey], cam, focal);
          if (!sa || !sb) continue;
          ctx.strokeStyle = `rgba(245, 250, 255, ${(b.life * 0.42).toFixed(2)})`;
          ctx.beginPath();
          ctx.moveTo(sa.x, sa.y);
          ctx.lineTo(sb.x, sb.y);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // Soft ground shadow directly beneath aircraft when flying low
    if (cam.mode !== 'cockpit' && ac.agl < 180) {
      const groundY = Math.max(0.5, ac.pos.y - ac.agl + 0.5);
      const shadowPt = worldPointToScreen({ x: ac.pos.x, y: groundY, z: ac.pos.z }, cam, focal);
      if (shadowPt) {
        const size = clamp((1 - ac.agl / 180) * (1200 / Math.max(12, shadowPt.z)), 4, 48);
        ctx.save();
        ctx.fillStyle = `rgba(6, 16, 28, ${(0.36 * (1 - ac.agl / 180)).toFixed(2)})`;
        ctx.beginPath();
        ctx.ellipse(shadowPt.x, shadowPt.y, size * 1.45, size * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Translucent spinning propeller blur disc
    const acBasis = buildBasis(ac.yaw, ac.pitch, ac.roll);
    const propWorld = {
      x: ac.pos.x + acBasis.forward.x * 4.4,
      y: ac.pos.y + acBasis.forward.y * 4.4 + acBasis.up.y * 0.05,
      z: ac.pos.z + acBasis.forward.z * 4.4,
    };
    const ps = worldPointToScreen(propWorld, cam, focal);
    if (ps) {
      const pr = (1.55 * focal) / ps.z;
      ctx.save();
      ctx.strokeStyle = 'rgba(225, 238, 250, 0.42)';
      ctx.fillStyle = 'rgba(205, 224, 240, 0.14)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(ps.x, ps.y, clamp(pr, 2, 160), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  /** Draw sleek canopy frame struts and forward nose cowling in Cockpit view. */
  function drawCockpitCanopy(ac) {
    const w = VIEWPORT.width;
    const h = VIEWPORT.height;
    ctx.save();

    // Nose engine cowling visible over the glare shield
    const pitchLift = clamp(ac.pitch * 45, -18, 22);
    const cowlingY = 472 + pitchLift;
    const cowlGrad = ctx.createLinearGradient(w * 0.5, cowlingY, w * 0.5, 550);
    cowlGrad.addColorStop(0, '#d93d32');
    cowlGrad.addColorStop(0.35, '#a62820');
    cowlGrad.addColorStop(1, '#263242');
    ctx.fillStyle = cowlGrad;
    ctx.beginPath();
    ctx.moveTo(w * 0.36, 545);
    ctx.lineTo(w * 0.43, cowlingY);
    ctx.lineTo(w * 0.57, cowlingY);
    ctx.lineTo(w * 0.64, 545);
    ctx.closePath();
    ctx.fill();

    // Canopy arch frame & side pillars
    ctx.strokeStyle = '#1b2430';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(0, 535);
    ctx.lineTo(195, 110);
    ctx.quadraticCurveTo(w * 0.5, 22, w - 195, 110);
    ctx.lineTo(w, 535);
    ctx.stroke();

    // Inner canopy metallic highlight
    ctx.strokeStyle = 'rgba(130, 165, 195, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(14, 535);
    ctx.lineTo(202, 114);
    ctx.quadraticCurveTo(w * 0.5, 30, w - 202, 114);
    ctx.lineTo(w - 14, 535);
    ctx.stroke();

    // Overhead compass bar mount
    ctx.fillStyle = '#151c26';
    ctx.fillRect(w * 0.5 - 64, 0, 128, 34);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(w * 0.5 - 64, 0, 128, 34);

    ctx.restore();
  }

  return {
    drawScene(world, ac, cam, missionState, simTime) {
      const theme = THEMES[missionState.mission.timeOfDay] ?? THEMES.day;
      const focal = getFocalLength(cam.fovDeg);

      drawSkyAndOcean(cam, theme, focal, simTime);

      const queue = [];
      queueTerrain(queue, world, cam, theme, simTime);
      queueRunways(queue, world.runways, cam, theme, simTime);
      queueLandmarks(queue, world.landmarks, cam, theme, simTime);
      queueTrees(queue, world.trees, cam, theme);
      queueClouds(queue, world.clouds, cam, theme, simTime);
      queueMissionGates(queue, missionState, cam, theme, simTime);

      if (cam.mode !== 'cockpit') {
        const acPolys = buildAircraftPolygons(ac);
        for (let i = 0; i < acPolys.length; i += 1) {
          const poly = acPolys[i];
          queuePoly(queue, poly.pts, poly.rgb, cam, theme, {
            doubleSided: poly.doubleSided,
            noFog: true,
            depthBias: -2,
            stroke: poly.stroke,
            lineWidth: 0.8,
          });
        }
      }

      // Painter's sort far-to-near
      queue.sort((a, b) => b.depth - a.depth);

      for (let i = 0; i < queue.length; i += 1) {
        const item = queue[i];
        const pts = item.camPts;
        if (item.alpha < 1) ctx.globalAlpha = item.alpha;
        ctx.fillStyle = item.color;
        ctx.beginPath();
        const p0 = projectCamPoint(pts[0], focal);
        ctx.moveTo(p0.x, p0.y);
        for (let j = 1; j < pts.length; j += 1) {
          const pj = projectCamPoint(pts[j], focal);
          ctx.lineTo(pj.x, pj.y);
        }
        ctx.closePath();
        ctx.fill();
        if (item.stroke) {
          ctx.strokeStyle = item.stroke;
          ctx.lineWidth = item.lineWidth;
          ctx.stroke();
        }
        if (item.alpha < 1) ctx.globalAlpha = 1;
      }

      drawAirEffects(ac, cam, focal);
      if (cam.mode === 'cockpit') drawCockpitCanopy(ac);

      return { focal, worldPointToScreen: (wp) => worldPointToScreen(wp, cam, focal) };
    },
  };
}
