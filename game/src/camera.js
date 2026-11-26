// Smooth spring-damped Chase camera, First-Person Cockpit camera, and Scenic Orbit camera.

import { buildBasis, clamp, lerp, norm3, cross3 } from './math3d.js';

export function createCameraState(ac) {
  const basis = buildBasis(ac.yaw, ac.pitch, ac.roll);
  return {
    mode: 'chase', // 'chase' | 'cockpit' | 'orbit'
    pos: {
      x: ac.pos.x - basis.forward.x * 20 + basis.up.x * 5,
      y: ac.pos.y - basis.forward.y * 20 + basis.up.y * 5,
      z: ac.pos.z - basis.forward.z * 20 + basis.up.z * 5,
    },
    basis: { ...basis },
    fovDeg: 64,
    orbitAngle: 0.45,
  };
}

export function stepCamera(cam, ac, world, dt, instant = false) {
  const acBasis = buildBasis(ac.yaw, ac.pitch, ac.roll);
  const blend = instant ? 1 : clamp(dt * 7.5, 0, 1);

  if (cam.mode === 'cockpit') {
    // Seated inside the glass canopy looking forward over the cowling
    const eyeWorld = {
      x: ac.pos.x + acBasis.up.x * 1.15 + acBasis.forward.x * 1.35,
      y: ac.pos.y + acBasis.up.y * 1.15 + acBasis.forward.y * 1.35,
      z: ac.pos.z + acBasis.up.z * 1.15 + acBasis.forward.z * 1.35,
    };
    cam.pos = eyeWorld;
    cam.basis = acBasis;
    cam.fovDeg = lerp(cam.fovDeg, ac.boosting ? 72 : 66, instant ? 1 : dt * 5);
    return;
  }

  if (cam.mode === 'orbit') {
    cam.orbitAngle += dt * 0.28;
    const dist = 24;
    const ox = Math.sin(cam.orbitAngle) * dist;
    const oz = Math.cos(cam.orbitAngle) * dist;
    const targetPos = {
      x: ac.pos.x + ox,
      y: Math.max(world.getHeight(ac.pos.x + ox, ac.pos.z + oz) + 8, ac.pos.y + 6.5),
      z: ac.pos.z + oz,
    };
    cam.pos.x = lerp(cam.pos.x, targetPos.x, blend);
    cam.pos.y = lerp(cam.pos.y, targetPos.y, blend);
    cam.pos.z = lerp(cam.pos.z, targetPos.z, blend);
    const lookFwd = norm3({
      x: ac.pos.x - cam.pos.x,
      y: ac.pos.y + 0.8 - cam.pos.y,
      z: ac.pos.z - cam.pos.z,
    });
    const right = norm3(cross3({ x: 0, y: 1, z: 0 }, lookFwd));
    const up = cross3(lookFwd, right);
    cam.basis = { right, up, forward: lookFwd };
    cam.fovDeg = 60;
    return;
  }

  // Default: Responsive Chase View with gentle lag and terrain safety floor
  const chaseDist = 19.0 + clamp((ac.airspeed - 55) * 0.08, 0, 4.5);
  const desiredPos = {
    x: ac.pos.x - acBasis.forward.x * chaseDist + acBasis.up.x * 5.0,
    y: ac.pos.y - acBasis.forward.y * chaseDist + acBasis.up.y * 5.0 + 1.0,
    z: ac.pos.z - acBasis.forward.z * chaseDist + acBasis.up.z * 5.0,
  };
  const camGround = Math.max(1.5, world.getHeight(desiredPos.x, desiredPos.z) + 3.2);
  if (desiredPos.y < camGround) desiredPos.y = camGround;

  cam.pos.x = lerp(cam.pos.x, desiredPos.x, blend);
  cam.pos.y = lerp(cam.pos.y, desiredPos.y, blend);
  cam.pos.z = lerp(cam.pos.z, desiredPos.z, blend);

  const lookTarget = {
    x: ac.pos.x + acBasis.forward.x * 26,
    y: ac.pos.y + acBasis.forward.y * 26 + 1.4,
    z: ac.pos.z + acBasis.forward.z * 26,
  };
  const lookFwd = norm3({
    x: lookTarget.x - cam.pos.x,
    y: lookTarget.y - cam.pos.y,
    z: lookTarget.z - cam.pos.z,
  });
  // Blend horizon up with partial aircraft bank for dynamic yet comfortable horizon stability
  const worldUp = { x: 0, y: 1, z: 0 };
  const bankBlend = {
    x: lerp(worldUp.x, acBasis.up.x, 0.35),
    y: lerp(worldUp.y, acBasis.up.y, 0.35),
    z: lerp(worldUp.z, acBasis.up.z, 0.35),
  };
  const right = norm3(cross3(bankBlend, lookFwd));
  const up = cross3(lookFwd, right);
  cam.basis = { right, up, forward: lookFwd };
  cam.fovDeg = lerp(cam.fovDeg, ac.boosting ? 73 : 64 + clamp((ac.airspeed - 60) * 0.1, 0, 5), instant ? 1 : dt * 5);
}
