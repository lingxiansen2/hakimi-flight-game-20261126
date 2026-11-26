// Deterministic screenshot scene staging using real flight physics, WebGL2 atmospheres, and autopilot.

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
  const targetThrottle = clamp(0.72 + spdErr * 0.04, 0.38, 0.96);
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
  let simSteps = 120;
  let camMode = 'chase';

  if (shotName === 'cockpit') {
    mission = MISSIONS[1]; // Stormfront Carrier Approach
    camMode = 'cockpit';
    simSteps = 85;
  } else if (shotName === 'canyon') {
    mission = MISSIONS[3]; // Sunset Canyon Slalom
    camMode = 'chase';
    simSteps = 95;
  } else if (shotName === 'landing') {
    mission = MISSIONS[2]; // Caldera Thermal Rescue final approach into Solara
    camMode = 'chase';
    simSteps = 80;
  }

  const ac = createAircraftState(mission);
  const ms = createMissionState(mission);

  if (shotName === 'chase') {
    // Cover: Golden-hour banking chase view over Solara Airfield & Harbor toward Bay Channel & Caldera
    ac.pos = { x: -110, y: 145, z: -480 };
    ac.yaw = 0.25;
    ac.pitch = 0.01;
    ac.roll = -0.30;
    ac.throttle = 0.78;
    ac.airspeed = 68;
    ac.vel = { x: Math.sin(ac.yaw) * 68, y: 0.4, z: Math.cos(ac.yaw) * 68 };
    ms.currentGateIndex = 1;
    ms.gatesCleared = 1;
    ms.gates[0].cleared = true;
    ms.bannerText = ms.gates[1].label;
    ms.score = 420;
  } else if (shotName === 'cockpit') {
    // 6-dial + MFD + Combiner Cockpit approaching CVN-07 Solara Aircraft Carrier in storm rain
    ac.pos = { x: -640, y: 122, z: 1320 };
    ac.yaw = 0.22;
    ac.pitch = -0.05;
    ac.roll = 0.06;
    ac.gearDown = true;
    ac.gearDeploy = 1;
    ac.flaps = true;
    ac.throttle = 0.62;
    ac.airspeed = 58;
    ac.vel = { x: Math.sin(ac.yaw) * 58, y: -2.2, z: Math.cos(ac.yaw) * 58 };
    ms.currentGateIndex = 2;
    ms.gatesCleared = 2;
    ms.gates[0].cleared = true;
    ms.gates[1].cleared = true;
    ms.bannerText = 'CARRIER GROOVE // GEAR DOWN & HOOK SET';
    ms.score = 1360;
  } else if (shotName === 'canyon') {
    // Sunset high-bank slalom with boost afterburner & contrails toward Volcano Canyon gate
    ac.pos = { x: 610, y: 272, z: 1180 };
    ac.yaw = 0.66;
    ac.pitch = 0.04;
    ac.roll = 0.66;
    ac.throttle = 0.94;
    ac.airspeed = 86;
    ac.boosting = true;
    ac.vel = { x: Math.sin(ac.yaw) * 86, y: 2.0, z: Math.cos(ac.yaw) * 86 };
    ms.currentGateIndex = 3;
    ms.gatesCleared = 3;
    for (let i = 0; i < 3; i += 1) ms.gates[i].cleared = true;
    ms.bannerText = ms.gates[3].label;
    ms.score = 1580;
  } else if (shotName === 'landing') {
    // Short final into Solara Airfield with Gear Down, Flaps Set, PAPI & Runway markings
    ac.pos = { x: 12, y: 78, z: -535 };
    ac.yaw = -0.03;
    ac.pitch = -0.04;
    ac.roll = 0.03;
    ac.gearDown = true;
    ac.gearDeploy = 1;
    ac.flaps = true;
    ac.throttle = 0.48;
    ac.airspeed = 48;
    ac.vel = { x: Math.sin(ac.yaw) * 48, y: -3.0, z: Math.cos(ac.yaw) * 48 };
    ms.runwayPhase = 'landing';
    for (let i = 0; i < ms.gates.length; i += 1) ms.gates[i].cleared = true;
    ms.gatesCleared = ms.gates.length;
    ms.bannerText = 'FINAL APPROACH // GEAR DOWN & FLAPS 30°';
    ms.score = 2480;
  }

  const cam = createCameraState(ac);
  cam.mode = camMode;
  stepCamera(cam, ac, world, STEP, true);

  let simTime = 0;
  for (let i = 0; i < simSteps; i += 1) {
    simTime += STEP;
    const target = getActiveTarget(ms, world.runways);
    const desiredAlt = shotName === 'landing' ? 50 : shotName === 'cockpit' ? 76 : target.y;
    const desiredSpd = shotName === 'landing' ? 46 : shotName === 'cockpit' ? 58 : shotName === 'canyon' ? 88 : 68;
    const ctrl = autopilotToward(ac, target, desiredSpd, desiredAlt);
    if (shotName === 'chase' && i > simSteps - 38) ctrl.roll = -0.58;
    if (shotName === 'canyon' && i > simSteps - 42) {
      ctrl.roll = 0.86;
      ctrl.boost = true;
    }
    stepFlightPhysics(ac, ctrl, world, ms.mission, STEP, simTime);
    stepMissionState(ms, ac, STEP);
    stepCamera(cam, ac, world, STEP, false);
  }

  return { ac, ms, cam, simTime };
}
