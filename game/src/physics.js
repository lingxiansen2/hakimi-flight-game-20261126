// 6-DOF aerodynamic flight physics, stall dynamics, wind gusts, fuel, hull stress, and runway landing.

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
    throttle: 0.72,
    rpm: 0.72,
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
  };
}

function computeWindVector(windCfg, timeSec) {
  const rad = ((windCfg.dirDeg + 180) * Math.PI) / 180;
  const gust = 1 + 0.25 * Math.sin(timeSec * 0.47) + 0.15 * Math.cos(timeSec * 1.13);
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

  // Throttle & discrete systems
  ac.throttle = clamp(ac.throttle + controls.throttleDelta * dt * 0.65, 0, 1);
  if (controls.toggleFlaps) ac.flaps = !ac.flaps;
  if (controls.toggleGear) ac.gearDown = !ac.gearDown;
  ac.airbrake = controls.airbrake;
  ac.boosting = controls.boost && ac.fuel > 0.5 && !ac.onGround;

  ac.gearDeploy = lerp(ac.gearDeploy, ac.gearDown ? 1 : 0, clamp(dt * 4.5, 0, 1));
  ac.touchdownBannerTimer = Math.max(0, ac.touchdownBannerTimer - dt);

  // Wind and relative airflow
  ac.windVec = computeWindVector(mission.wind, simTime);
  const relVel = {
    x: ac.vel.x - ac.windVec.x,
    y: ac.vel.y - ac.windVec.y,
    z: ac.vel.z - ac.windVec.z,
  };
  const airspeed = Math.hypot(relVel.x, relVel.y, relVel.z);
  ac.airspeed = airspeed;

  // Control authority scales smoothly with airflow (still responsive near stall)
  const authority = clamp(0.32 + (airspeed / AIRCRAFT_SPEC.cruiseSpeed) * 0.78, 0.32, 1.15);
  ac.aileronInput = lerp(ac.aileronInput, controls.roll, clamp(dt * 9, 0, 1));
  ac.elevatorInput = lerp(ac.elevatorInput, controls.pitch, clamp(dt * 9, 0, 1));

  // Angular rates
  const rollRate = ac.aileronInput * AIRCRAFT_SPEC.rollRate * authority;
  const pitchRate = ac.elevatorInput * AIRCRAFT_SPEC.pitchRate * authority;
  const rudderRate = controls.yaw * AIRCRAFT_SPEC.yawRate * authority;

  ac.roll = clamp(ac.roll + rollRate * dt, -1.35, 1.35);
  // Gentle roll auto-leveling only when hands-off near level flight
  if (Math.abs(controls.roll) < 0.05 && Math.abs(ac.roll) < 0.28) {
    ac.roll = lerp(ac.roll, 0, clamp(dt * 0.55, 0, 1));
  }

  ac.pitch = clamp(ac.pitch + pitchRate * dt, -1.05, 1.05);

  // Coordinated bank-to-turn yaw rate
  const bankTurn = Math.sin(ac.roll) * clamp(airspeed / 48, 0.25, 1.3) * 0.68;
  ac.yaw = wrapAngle(ac.yaw + (bankTurn + rudderRate) * dt);

  const basis = buildBasis(ac.yaw, ac.pitch, ac.roll);

  // Angle of attack between forward axis and relative airspeed
  let aoa = 0;
  if (airspeed > 4) {
    const flowDir = norm3(relVel);
    const forwardDot = clamp(dot3(basis.forward, flowDir), -1, 1);
    const upDot = dot3(basis.up, flowDir);
    aoa = Math.atan2(-upDot, forwardDot);
  }
  ac.aoa = aoa;

  // Stall check & nose drop moment
  const stallAngle = ac.flaps ? 0.42 : 0.34;
  const isStalling = !ac.onGround && (airspeed < AIRCRAFT_SPEC.stallSpeed * (ac.flaps ? 0.82 : 1) || Math.abs(aoa) > stallAngle);
  ac.stalling = isStalling;
  if (isStalling) {
    events.stalled = true;
    ac.pitch = clamp(ac.pitch - dt * 0.38, -1.05, 1.05);
  }

  // Fuel consumption
  const effectiveThrottle = ac.fuel > 0 ? ac.throttle : 0;
  const burnRate = AIRCRAFT_SPEC.fuelBurnBase * (0.18 + effectiveThrottle * 0.82)
    + (ac.boosting ? AIRCRAFT_SPEC.boostBurnExtra : 0);
  ac.fuel = Math.max(0, ac.fuel - burnRate * dt);
  ac.rpm = lerp(ac.rpm, effectiveThrottle * (ac.boosting ? 1.28 : 1), clamp(dt * 5, 0, 1));
  ac.propAngle = (ac.propAngle + (18 + ac.rpm * 44) * dt) % (Math.PI * 2);

  // Thrust force along aircraft forward vector
  const thrustMag = effectiveThrottle * AIRCRAFT_SPEC.maxThrust * (ac.boosting ? AIRCRAFT_SPEC.boostMultiplier : 1);
  const thrust = {
    x: basis.forward.x * thrustMag,
    y: basis.forward.y * thrustMag,
    z: basis.forward.z * thrustMag,
  };

  // Lift force along dorsal up vector (with AoA stall rolloff & gentle flight-path alignment)
  const clBase = 0.36 + clamp(aoa * 3.4, -0.7, 1.15) + (ac.flaps ? AIRCRAFT_SPEC.flapLiftBonus : 0);
  const stallFactor = isStalling ? 0.42 : 1.0;
  const liftAccel = airspeed * airspeed * AIRCRAFT_SPEC.wingAreaFactor * clBase * stallFactor;
  const lift = {
    x: basis.up.x * liftAccel,
    y: basis.up.y * liftAccel,
    z: basis.up.z * liftAccel,
  };

  // Drag (parasite + induced + flaps + gear + airbrake)
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

  // Weathervane alignment: smoothly pulls velocity vector toward nose (side-slip damping)
  const speedTotal = Math.hypot(ac.vel.x, ac.vel.y, ac.vel.z);
  const alignRate = (ac.onGround ? 5.5 : 1.85) * dt;
  const desiredVel = {
    x: basis.forward.x * speedTotal,
    y: basis.forward.y * speedTotal,
    z: basis.forward.z * speedTotal,
  };

  const prevVy = ac.vel.y;
  ac.vel.x = lerp(ac.vel.x, desiredVel.x, clamp(alignRate, 0, 1)) + (thrust.x + lift.x + drag.x) * dt;
  ac.vel.y = lerp(ac.vel.y, desiredVel.y, clamp(alignRate * 0.55, 0, 1)) + (thrust.y + lift.y + drag.y - AIRCRAFT_SPEC.gravity) * dt;
  ac.vel.z = lerp(ac.vel.z, desiredVel.z, clamp(alignRate, 0, 1)) + (thrust.z + lift.z + drag.z) * dt;

  // Soft speed cap
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

  // Gentle archipelago boundary keep-in past 3.8km
  const radial = Math.hypot(ac.pos.x, ac.pos.z);
  if (radial > 3800) {
    const pushBack = (radial - 3800) * 0.04 * dt;
    ac.vel.x -= (ac.pos.x / radial) * pushBack * 25;
    ac.vel.z -= (ac.pos.z / radial) * pushBack * 25;
  }

  // G-load estimation
  const ay = (ac.vel.y - prevVy) / Math.max(dt, 1e-4) + AIRCRAFT_SPEC.gravity;
  const turnG = Math.abs(Math.sin(ac.roll)) * (airspeed / 45);
  ac.gLoad = clamp(lerp(ac.gLoad, Math.abs(ay / AIRCRAFT_SPEC.gravity) + turnG, clamp(dt * 6, 0, 1)), 0.2, 8.5);
  if (ac.gLoad > AIRCRAFT_SPEC.maxGLoad) {
    ac.hull = Math.max(0, ac.hull - (ac.gLoad - AIRCRAFT_SPEC.maxGLoad) * 4.5 * dt);
  }

  // Terrain / runway / ocean contact
  const groundH = Math.max(0, world.getHeight(ac.pos.x, ac.pos.z));
  const runway = world.findRunway(ac.pos.x, ac.pos.z);
  const clearance = 1.0 + ac.gearDeploy * 0.65;
  ac.agl = Math.max(0, ac.pos.y - groundH);
  ac.verticalSpeed = ac.vel.y;
  ac.onGround = false;
  ac.onWater = false;
  ac.onRunway = runway;

  if (ac.pos.y - clearance <= groundH) {
    const sink = -ac.vel.y;
    const isWater = groundH <= 0.1 && !runway;
    const flatRoll = Math.abs(ac.roll) < 0.38;
    const safePitch = ac.pitch > -0.32 && ac.pitch < 0.45;

    if (runway && ac.gearDown && sink <= AIRCRAFT_SPEC.maxLandingSink && flatRoll && safePitch) {
      // Smooth runway rolling / landing
      if (sink > 1.6) {
        events.touchdown = true;
        events.gearChirp = true;
        ac.touchdownBannerTimer = 2.6;
        ac.touchdownQuality = sink < 2.8 ? 'GREASED TOUCHDOWN' : 'RUNWAY LANDING';
      }
      ac.pos.y = groundH + clearance;
      ac.vel.y = Math.max(0, ac.vel.y);
      ac.roll = lerp(ac.roll, 0, clamp(dt * 8, 0, 1));
      ac.pitch = clamp(ac.pitch, -0.02, 0.22);
      ac.onGround = true;

      // Ground rolling drag & braking
      const brakeRate = ac.airbrake || ac.throttle < 0.2 ? 0.58 : 0.12;
      ac.vel.x *= Math.max(0, 1 - brakeRate * dt);
      ac.vel.z *= Math.max(0, 1 - brakeRate * dt);

      // Runway service: refuel and repair when rolling steadily on deck
      if (ac.hull < 100 || ac.fuel < 100) {
        ac.hull = Math.min(100, ac.hull + 16 * dt);
        ac.fuel = Math.min(100, ac.fuel + 22 * dt);
        events.repaired = true;
      }
    } else if (isWater && sink <= 5.2 && flatRoll && safePitch) {
      // Seaplane hull/pontoon water skimming
      if (sink > 1.5) {
        events.touchdown = true;
        ac.touchdownBannerTimer = 2.2;
        ac.touchdownQuality = 'SEAPLANE SPLASHDOWN';
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
      // Hard terrain or gear-up belly strike
      const dmg = Math.max(14, (sink - 2.0) * 14 + (flatRoll ? 0 : 28) + (runway && !ac.gearDown ? 35 : 0));
      ac.hull = Math.max(0, ac.hull - dmg);
      if (ac.hull <= 0) {
        ac.crashed = true;
        ac.crashReason = isWater ? 'HIGH-SPEED WATER IMPACT' : runway && !ac.gearDown ? 'GEAR-UP BELLY IMPACT' : 'TERRAIN COLLISION';
        events.crashed = true;
      } else {
        // Elastic bounce recovery with airframe damage
        ac.pos.y = groundH + clearance + 1.5;
        ac.vel.y = Math.max(12, Math.abs(ac.vel.y) * 0.45);
        ac.pitch = Math.max(0.14, ac.pitch);
        ac.roll *= 0.4;
      }
    }
  }

  if (ac.hull <= 0 && !ac.crashed) {
    ac.crashed = true;
    ac.crashReason = 'AIRFRAME OVERSTRESS';
    events.crashed = true;
  }

  // Record wingtip contrails when flying fast or pulling high-G banks
  ac.contrailTick += dt;
  if (!ac.onGround && (airspeed > 56 || ac.gLoad > 1.65) && ac.contrailTick >= 0.045) {
    ac.contrailTick = 0;
    const leftTip = localToWorld({ x: -7.1, y: 1.0, z: -0.6 }, ac.pos, basis);
    const rightTip = localToWorld({ x: 7.1, y: 1.0, z: -0.6 }, ac.pos, basis);
    ac.contrails.push({ left: leftTip, right: rightTip, life: 1.0 });
    if (ac.contrails.length > 36) ac.contrails.shift();
  }
  for (let i = ac.contrails.length - 1; i >= 0; i -= 1) {
    ac.contrails[i].life -= dt * 0.55;
    if (ac.contrails[i].life <= 0) ac.contrails.splice(i, 1);
  }

  return events;
}
