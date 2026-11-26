// Deterministic screenshot scene staging using real flight physics, WebGL2 atmospheres, and mid-sortie telemetry.

import { MISSIONS, STEP } from './config.js';
import { clamp, wrapAngle } from './math3d.js';
import { createAircraftState, stepFlightPhysics } from './physics.js';
import { createMissionState, getActiveTarget, stepMissionState } from './missions.js';
import { createCameraState, stepCamera } from './camera.js';

function autopilotToward(ac, targetPos, desiredSpeed, desiredAlt) {
  const bearing = Math.atan2(targetPos.x - ac.pos.x, targetPos.z - ac.pos.z);
  const hdgErr = wrapAngle(bearing - ac.yaw);
  const wantedRoll = clamp(hdgErr * 1.45, -0.68, 0.68);
  const roll = clamp((wantedRoll - ac.roll) * 2.1, -1, 1);

  const altErr = desiredAlt - ac.pos.y;
  const wantedPitch = clamp(altErr * 0.012, -0.24, 0.24);
  const pitch = clamp((wantedPitch - ac.pitch) * 2.4, -1, 1);

  const spdErr = desiredSpeed - ac.airspeed;
  const targetThrottle = clamp(0.74 + spdErr * 0.04, 0.40, 0.96);
  const throttleDelta = clamp((targetThrottle - ac.throttle) * 3.0, -1, 1);

  return {
    roll,
    pitch,
    yaw: clamp(hdgErr * 0.4, -0.4, 0.4),
    throttleDelta,
    toggleFlaps: false,
    toggleGear: false,
    airbrake: false,
    boost: false,
  };
}

export function stageShotScene(shotName, world) {
  let mission = MISSIONS[0];
  let simSteps = 105;
  let camMode = 'chase';

  if (shotName === 'cockpit') {
    mission = MISSIONS[1]; // Stormfront Carrier Approach
    camMode = 'cockpit';
    simSteps = 80;
  } else if (shotName === 'caldera') {
    mission = { ...MISSIONS[2], timeOfDay: 'sunset' }; // Warm sunset Caldera Thermal Rescue
    camMode = 'chase';
    simSteps = 90;
  } else if (shotName === 'landing') {
    mission = MISSIONS[2]; // Final approach into Solara Airfield
    camMode = 'chase';
    simSteps = 75;
  }

  const ac = createAircraftState(mission);
  const ms = createMissionState(mission);

  if (shotName === 'chase') {
    // Cover: Golden-hour banking pass framing Solara Runway, Harbor Village, Suspension Bridge, Bay Gate 2 & Caldera
    ac.pos = { x: -120, y: 152, z: -420 };
    ac.yaw = 0.26;
    ac.pitch = 0.01;
    ac.roll = -0.30;
    ac.throttle = 0.78;
    ac.airspeed = 68;
    ac.fuel = 79;
    ac.hull = 94;
    ac.vel = { x: Math.sin(ac.yaw) * 68, y: 0.4, z: Math.cos(ac.yaw) * 68 };
    ms.currentGateIndex = 1;
    ms.gatesCleared = 1;
    ms.gates[0].cleared = true;
    ms.bannerText = ms.gates[1].label;
    ms.score = 640;
    ms.elapsed = 34;
  } else if (shotName === 'cockpit') {
    // 6-dial + MFD + Combiner Cockpit approaching CVN-07 Solara Carrier in storm rain
    ac.pos = { x: -635, y: 120, z: 1330 };
    ac.yaw = 0.21;
    ac.pitch = -0.05;
    ac.roll = 0.06;
    ac.gearDown = true;
    ac.gearDeploy = 1;
    ac.flaps = true;
    ac.throttle = 0.62;
    ac.airspeed = 58;
    ac.fuel = 62;
    ac.hull = 90;
    ac.vel = { x: Math.sin(ac.yaw) * 58, y: -2.2, z: Math.cos(ac.yaw) * 58 };
    ms.currentGateIndex = 2;
    ms.gatesCleared = 2;
    ms.gates[0].cleared = true;
    ms.gates[1].cleared = true;
    ms.bannerText = 'CARRIER GROOVE // GEAR DOWN & HOOK SET';
    ms.score = 1360;
    ms.elapsed = 52;
  } else if (shotName === 'caldera') {
    // Sunlit Caldera Thermal Rescue: aircraft high over saddle, brightly lit against sunset sky looking at glowing caldera & thermals
    ac.pos = { x: 845, y: 368, z: 1080 };
    ac.yaw = 0.24;
    ac.pitch = -0.04;
    ac.roll = 0.44;
    ac.throttle = 0.94;
    ac.airspeed = 82;
    ac.boosting = true;
    ac.fuel = 55;
    ac.hull = 86;
    ac.vel = { x: Math.sin(ac.yaw) * 82, y: -1.0, z: Math.cos(ac.yaw) * 82 };
    ms.currentGateIndex = 0;
    ms.gatesCleared = 0;
    ms.bannerText = 'THERMAL 1 // CALDERA CRATER RESCUE';
    ms.score = 1480;
    ms.elapsed = 61;
  } else if (shotName === 'landing') {
    // Short final into Solara Airfield with Gear Down, Flaps 30°, PAPI lights, Harbor & Bridge in view
    ac.pos = { x: 8, y: 76, z: -510 };
    ac.yaw = -0.02;
    ac.pitch = -0.04;
    ac.roll = 0.03;
    ac.gearDown = true;
    ac.gearDeploy = 1;
    ac.flaps = true;
    ac.throttle = 0.48;
    ac.airspeed = 48;
    ac.fuel = 43;
    ac.hull = 88;
    ac.vel = { x: Math.sin(ac.yaw) * 48, y: -2.8, z: Math.cos(ac.yaw) * 48 };
    ms.runwayPhase = 'landing';
    for (let i = 0; i < ms.gates.length; i += 1) ms.gates[i].cleared = true;
    ms.gatesCleared = ms.gates.length;
    ms.bannerText = 'BUTTER GLIDESLOPE // GEAR DOWN & FLAPS 30°';
    ms.score = 2640;
    ms.elapsed = 94;
  }

  const cam = createCameraState(ac);
  cam.mode = camMode;
  stepCamera(cam, ac, world, STEP, true);

  let simTime = 0;
  for (let i = 0; i < simSteps; i += 1) {
    simTime += STEP;
    const target = getActiveTarget(ms, world.runways);
    const desiredAlt = shotName === 'landing' ? 50 : shotName === 'cockpit' ? 76 : shotName === 'caldera' ? 345 : target.y;
    const desiredSpd = shotName === 'landing' ? 46 : shotName === 'cockpit' ? 58 : shotName === 'caldera' ? 84 : 68;
    const ctrl = autopilotToward(ac, target, desiredSpd, desiredAlt);
    if (shotName === 'chase' && i > simSteps - 36) ctrl.roll = -0.52;
    if (shotName === 'caldera' && i > simSteps - 34) {
      ctrl.roll = 0.62;
      ctrl.boost = true;
    }
    stepFlightPhysics(ac, ctrl, world, ms.mission, STEP, simTime);
    stepMissionState(ms, ac, STEP);
    stepCamera(cam, ac, world, STEP, false);
  }

  return { ac, ms, cam, simTime };
}
