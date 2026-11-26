// 6-DOF aerodynamic flight physics, stall dynamics, thermals, carrier arrestor landings, and fuel/hull damage.

import { AIRCRAFT_SPEC } from './config.js';
import { buildBasis, clamp, dot3, lerp, localToWorld, norm3, wrapAngle } from './math3d.js';

export function createAircraftState(mission) {
  const start = mission.startPos;
  const spd = mission.startSpeed;
  const sy = Math.sin(mission.startYaw);
  const cy = Math.cos(mission.startYaw);
  return {
    pos: { x: start.x, y: start.y, z: start.z },
    vel: { x: sy * spd, y: 0, z: cy * spd },
    yaw: mission.startYaw,
    pitch: 0.02,
    roll: 0,
    throttle: 0.74,
    rpm: 0.74,
    flaps: false,
    gearDown: false,
    gearDeploy: 0,
    airbrake: false,
    boosting: false,
    fuel: 100,
    hull: 100,
    gLoad: 1.0,
    aoa: 0.04,
    stalling: false,
    onGround: false,
    onWater: false,
    onRunway: null,
    crashed: false,
    crashReason: '',
    propAngle: 0,
    aileronInput: 0,
    elevatorInput: 0,
    agl: start.y,
    airspeed: spd,
    verticalSpeed: 0,
    windVec: computeWindVector(mission.wind, 0),
    contrails: [],
    contrailTick: 0,
    touchdownBannerTimer: 0,
    touchdownQuality: '',
    lastTouchdownGrade: '',
  };
}

function computeWindVector(windCfg, timeSec) {
  const rad = ((windCfg.dirDeg + 180) * Math.PI) / 180;
  const gust = 1 + 0.24 * Math.sin(timeSec * 0.47) + 0.14 * Math.cos(timeSec * 1.13);
  const spd = windCfg.speed * gust;
  return { x: Math.sin(rad) * spd, y: 0, z: Math.cos(rad) * spd };
}

export function stepFlightPhysics(ac, controls, world, mission, dt, simTime) {
  const events = {
    stalled: false,
    touchdown: false,
    repaired: false,
    crashed: false,
    gearChirp: false,
  };

  if (ac.crashed) return events;

  ac.throttle = clamp(ac.throttle + controls.throttleDelta * dt * 0.65, 0, 1);
  if (controls.toggleFlaps) ac.flaps = !ac.flaps;
  if (controls.toggleGear) ac.gearDown = !ac.gearDown;
  ac.airbrake = controls.airbrake;
  ac.boosting = controls.boost && ac.fuel > 0.5 && !ac.onGround;

  ac.gearDeploy = lerp(ac.gearDeploy, ac.gearDown ? 1 : 0, clamp(dt * 4.5, 0, 1));
  ac.touchdownBannerTimer = Math.max(0, ac.touchdownBannerTimer - dt);

  ac.windVec = computeWindVector(mission.wind, simTime);
  const thermalUp = world.getThermalLift ? world.getThermalLift(ac.pos.x, ac.pos.z) : 0;
  const relVel = {
    x: ac.vel.x - ac.windVec.x,
    y: ac.vel.y - thermalUp,
    z: ac.vel.z - ac.windVec.z,
  };
  const airspeed = Math.hypot(relVel.x, relVel.y, relVel.z);
  ac.airspeed = airspeed;

  const authority = clamp(0.32 + (airspeed / AIRCRAFT_SPEC.cruiseSpeed) * 0.78, 0.32, 1.15);
  ac.aileronInput = lerp(ac.aileronInput, controls.roll, clamp(dt * 9, 0, 1));
  ac.elevatorInput = lerp(ac.elevatorInput, controls.pitch, clamp(dt * 9, 0, 1));

  ac.roll = clamp(ac.roll + ac.aileronInput * AIRCRAFT_SPEC.rollRate * authority * dt, -1.35, 1.35);
  if (Math.abs(controls.roll) < 0.05 && Math.abs(ac.roll) < 0.28) {
    ac.roll = lerp(ac.roll, 0, clamp(dt * 0.55, 0, 1));
  }
  ac.pitch = clamp(ac.pitch + ac.elevatorInput * AIRCRAFT_SPEC.pitchRate * authority * dt, -1.05, 1.05);

  const bankTurn = Math.sin(ac.roll) * clamp(airspeed / 48, 0.25, 1.3) * 0.68;
  ac.yaw = wrapAngle(ac.yaw + (bankTurn + controls.yaw * AIRCRAFT_SPEC.yawRate * authority) * dt);

  const basis = buildBasis(ac.yaw, ac.pitch, ac.roll);

  let aoa = 0;
  if (airspeed > 4) {
    const flowDir = norm3(relVel);
    const forwardDot = clamp(dot3(basis.forward, flowDir), -1, 1);
    const upDot = dot3(basis.up, flowDir);
    aoa = Math.atan2(-upDot, forwardDot);
  }
  ac.aoa = aoa;

  const stallAngle = ac.flaps ? 0.42 : 0.34;
  const isStalling = !ac.onGround && (airspeed < AIRCRAFT_SPEC.stallSpeed * (ac.flaps ? 0.82 : 1) || Math.abs(aoa) > stallAngle);
  ac.stalling = isStalling;
  if (isStalling) {
    events.stalled = true;
    ac.pitch = clamp(ac.pitch - dt * 0.38, -1.05, 1.05);
  }

  const effectiveThrottle = ac.fuel > 0 ? ac.throttle : 0;
  const burnRate = AIRCRAFT_SPEC.fuelBurnBase * (0.18 + effectiveThrottle * 0.82)
    + (ac.boosting ? AIRCRAFT_SPEC.boostBurnExtra : 0);
  ac.fuel = Math.max(0, ac.fuel - burnRate * dt);
  ac.rpm = lerp(ac.rpm, effectiveThrottle * (ac.boosting ? 1.28 : 1), clamp(dt * 5, 0, 1));
  ac.propAngle = (ac.propAngle + (18 + ac.rpm * 44) * dt) % (Math.PI * 2);

  const thrustMag = effectiveThrottle * AIRCRAFT_SPEC.maxThrust * (ac.boosting ? AIRCRAFT_SPEC.boostMultiplier : 1);
  const thrust = {
    x: basis.forward.x * thrustMag,
    y: basis.forward.y * thrustMag,
    z: basis.forward.z * thrustMag,
  };

  const clBase = 0.36 + clamp(aoa * 3.4, -0.7, 1.15) + (ac.flaps ? AIRCRAFT_SPEC.flapLiftBonus : 0);
  const stallFactor = isStalling ? 0.42 : 1.0;
  const liftAccel = airspeed * airspeed * AIRCRAFT_SPEC.wingAreaFactor * clBase * stallFactor;
  const lift = {
    x: basis.up.x * liftAccel,
    y: basis.up.y * liftAccel,
    z: basis.up.z * liftAccel,
  };

  const dragCoeff = AIRCRAFT_SPEC.baseDrag
    + AIRCRAFT_SPEC.inducedDrag * Math.max(0, clBase) * Math.max(0, clBase) * 0.08
    + (ac.flaps ? AIRCRAFT_SPEC.flapDragPenalty : 0)
    + ac.gearDeploy * AIRCRAFT_SPEC.gearDragPenalty
    + (ac.airbrake ? AIRCRAFT_SPEC.brakeDragPenalty : 0);
  const dragMag = airspeed * airspeed * dragCoeff * 0.11;
  const flowNorm = airspeed > 0.5 ? norm3(relVel) : basis.forward;
  const drag = {
    x: -flowNorm.x * dragMag,
    y: -flowNorm.y * dragMag,
    z: -flowNorm.z * dragMag,
  };

  const speedTotal = Math.hypot(ac.vel.x, ac.vel.y, ac.vel.z);
  const alignRate = (ac.onGround ? 5.5 : 1.85) * dt;
  const desiredVel = {
    x: basis.forward.x * speedTotal,
    y: basis.forward.y * speedTotal,
    z: basis.forward.z * speedTotal,
  };

  const prevVy = ac.vel.y;
  ac.vel.x = lerp(ac.vel.x, desiredVel.x, clamp(alignRate, 0, 1)) + (thrust.x + lift.x + drag.x) * dt;
  ac.vel.y = lerp(ac.vel.y, desiredVel.y, clamp(alignRate * 0.55, 0, 1)) + (thrust.y + lift.y + drag.y - AIRCRAFT_SPEC.gravity + thermalUp * 0.65) * dt;
  ac.vel.z = lerp(ac.vel.z, desiredVel.z, clamp(alignRate, 0, 1)) + (thrust.z + lift.z + drag.z) * dt;

  const nextSpeed = Math.hypot(ac.vel.x, ac.vel.y, ac.vel.z);
  const maxSpd = AIRCRAFT_SPEC.maxSpeed * (ac.boosting ? 1.18 : 1.0);
  if (nextSpeed > maxSpd) {
    const s = lerp(nextSpeed, maxSpd, clamp(dt * 3, 0, 1)) / nextSpeed;
    ac.vel.x *= s;
    ac.vel.y *= s;
    ac.vel.z *= s;
  }

  ac.pos.x += ac.vel.x * dt;
  ac.pos.y += ac.vel.y * dt;
  ac.pos.z += ac.vel.z * dt;

  const radial = Math.hypot(ac.pos.x, ac.pos.z);
  if (radial > 3800) {
    const pushBack = (radial - 3800) * 0.04 * dt;
    ac.vel.x -= (ac.pos.x / radial) * pushBack * 25;
    ac.vel.z -= (ac.pos.z / radial) * pushBack * 25;
  }

  const ay = (ac.vel.y - prevVy) / Math.max(dt, 1e-4) + AIRCRAFT_SPEC.gravity;
  const turnG = Math.abs(Math.sin(ac.roll)) * (airspeed / 45);
  ac.gLoad = clamp(lerp(ac.gLoad, Math.abs(ay / AIRCRAFT_SPEC.gravity) + turnG, clamp(dt * 6, 0, 1)), 0.2, 8.5);
  if (ac.gLoad > AIRCRAFT_SPEC.maxGLoad) {
    ac.hull = Math.max(0, ac.hull - (ac.gLoad - AIRCRAFT_SPEC.maxGLoad) * 4.5 * dt);
  }

  const surfaceH = Math.max(0, world.getSurfaceHeight ? world.getSurfaceHeight(ac.pos.x, ac.pos.z) : world.getHeight(ac.pos.x, ac.pos.z));
  const runway = world.findRunway(ac.pos.x, ac.pos.z);
  const clearance = 1.05 + ac.gearDeploy * 0.65;
  ac.agl = Math.max(0, ac.pos.y - surfaceH);
  ac.verticalSpeed = ac.vel.y;
  ac.onGround = false;
  ac.onWater = false;
  ac.onRunway = runway;

  if (ac.pos.y - clearance <= surfaceH) {
    const sink = -ac.vel.y;
    const isWater = surfaceH <= 0.1 && !runway;
    const flatRoll = Math.abs(ac.roll) < 0.38;
    const safePitch = ac.pitch > -0.32 && ac.pitch < 0.45;

    if (runway && ac.gearDown && sink <= AIRCRAFT_SPEC.maxLandingSink && flatRoll && safePitch) {
      if (sink > 1.4) {
        events.touchdown = true;
        events.gearChirp = true;
        ac.touchdownBannerTimer = 3.0;
        const grade = sink < 1.9 ? 'BUTTER' : sink < 4.0 ? 'FIRM' : 'HARD';
        ac.lastTouchdownGrade = grade;
        ac.touchdownQuality = runway.isCarrier ? `CARRIER ARREST (${grade})` : `TOUCHDOWN (${grade})`;
      }
      ac.pos.y = surfaceH + clearance;
      ac.vel.y = Math.max(0, ac.vel.y);
      ac.roll = lerp(ac.roll, 0, clamp(dt * 8, 0, 1));
      ac.pitch = clamp(ac.pitch, -0.02, 0.22);
      ac.onGround = true;

      const brakeRate = runway.isCarrier ? 1.45 : (ac.airbrake || ac.throttle < 0.2 ? 0.62 : 0.14);
      ac.vel.x *= Math.max(0, 1 - brakeRate * dt);
      ac.vel.z *= Math.max(0, 1 - brakeRate * dt);

      if (ac.hull < 100 || ac.fuel < 100) {
        ac.hull = Math.min(100, ac.hull + 16 * dt);
        ac.fuel = Math.min(100, ac.fuel + 22 * dt);
        events.repaired = true;
      }
    } else if (isWater && sink <= 5.2 && flatRoll && safePitch) {
      if (sink > 1.4) {
        events.touchdown = true;
        ac.touchdownBannerTimer = 2.4;
        ac.lastTouchdownGrade = sink < 2.2 ? 'BUTTER' : 'FIRM';
        ac.touchdownQuality = `SEAPLANE SPLASHDOWN (${ac.lastTouchdownGrade})`;
      }
      ac.pos.y = clearance;
      ac.vel.y = Math.max(0, ac.vel.y);
      ac.roll = lerp(ac.roll, 0, clamp(dt * 6, 0, 1));
      ac.pitch = clamp(ac.pitch, 0, 0.25);
      ac.onGround = true;
      ac.onWater = true;
      ac.vel.x *= Math.max(0, 1 - 0.55 * dt);
      ac.vel.z *= Math.max(0, 1 - 0.55 * dt);
    } else {
      const dmg = Math.max(15, (sink - 2.0) * 14 + (flatRoll ? 0 : 28) + (runway && !ac.gearDown ? 35 : 0));
      ac.hull = Math.max(0, ac.hull - dmg);
      if (ac.hull <= 0) {
        ac.crashed = true;
        ac.lastTouchdownGrade = 'CRASH';
        ac.crashReason = isWater ? 'HIGH-SPEED WATER IMPACT' : runway && !ac.gearDown ? 'GEAR-UP BELLY IMPACT' : 'TERRAIN COLLISION';
        events.crashed = true;
      } else {
        ac.pos.y = surfaceH + clearance + 1.5;
        ac.vel.y = Math.max(12, Math.abs(ac.vel.y) * 0.45);
        ac.pitch = Math.max(0.14, ac.pitch);
        ac.roll *= 0.4;
      }
    }
  }

  if (ac.hull <= 0 && !ac.crashed) {
    ac.crashed = true;
    ac.lastTouchdownGrade = 'CRASH';
    ac.crashReason = 'AIRFRAME OVERSTRESS';
    events.crashed = true;
  }

  ac.contrailTick += dt;
  if (!ac.onGround && (airspeed > 54 || ac.gLoad > 1.55 || ac.boosting) && ac.contrailTick >= 0.04) {
    ac.contrailTick = 0;
    const leftTip = localToWorld({ x: -7.3, y: 1.12, z: -0.6 }, ac.pos, basis);
    const rightTip = localToWorld({ x: 7.3, y: 1.12, z: -0.6 }, ac.pos, basis);
    ac.contrails.push({ left: leftTip, right: rightTip, life: 1.0 });
    if (ac.contrails.length > 42) ac.contrails.shift();
  }
  for (let i = ac.contrails.length - 1; i >= 0; i -= 1) {
    ac.contrails[i].life -= dt * 0.52;
    if (ac.contrails[i].life <= 0) ac.contrails.splice(i, 1);
  }

  return events;
}
