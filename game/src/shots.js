// Deterministic screenshot scene staging using the real flight physics and autopilot steering.

import { MISSIONS, STEP } from './config.js';
import { clamp, wrapAngle } from './math3d.js';
import { createAircraftState, stepFlightPhysics } from './physics.js';
import { createMissionState, getActiveTarget, stepMissionState } from './missions.js';
import { createCameraState, stepCamera } from './camera.js';

/** Simple proportional autopilot that steers toward an active waypoint or runway glidepath. */
function autopilotToward(ac, targetPos, desiredSpeed, desiredAlt) {
  const bearing = Math.atan2(targetPos.x - ac.pos.x, targetPos.z - ac.pos.z);
  const hdgErr = wrapAngle(bearing - ac.yaw);
  const wantedRoll = clamp(hdgErr * 1.45, -0.68, 0.68);
  const roll = clamp((wantedRoll - ac.roll) * 2.1, -1, 1);

  const altErr = desiredAlt - ac.pos.y;
  const wantedPitch = clamp(altErr * 0.012, -0.24, 0.24);
  const pitch = clamp((wantedPitch - ac.pitch) * 2.4, -1, 1);

  const spdErr = desiredSpeed - ac.airspeed;
  const targetThrottle = clamp(0.68 + spdErr * 0.04, 0.35, 0.96);
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
  let simSteps = 150;
  let camMode = 'chase';

  if (shotName === 'cockpit') {
    mission = MISSIONS[1]; // Golden-hour Stormwatch Beacon Run
    camMode = 'cockpit';
    simSteps = 120;
  } else if (shotName === 'canyon') {
    mission = MISSIONS[2]; // Sunset Sunburst Slalom Trial
    camMode = 'chase';
    simSteps = 110;
  } else if (shotName === 'landing') {
    mission = MISSIONS[0]; // Final approach onto Solara strip
    camMode = 'chase';
    simSteps = 85;
  }

  const ac = createAircraftState(mission);
  const ms = createMissionState(mission);

  // Position each shot cleanly along its mission corridor, then fly real simulation frames forward
  if (shotName === 'chase') {
    // Classic cover: sweeping banking approach over Solara Airfield & turquoise bay toward Gate 1 & Caldera peaks
    ac.pos = { x: -135, y: 155, z: -560 };
    ac.yaw = 0.24;
    ac.pitch = 0.01;
    ac.roll = -0.34;
    ac.throttle = 0.78;
    ac.airspeed = 68;
    ac.vel = { x: Math.sin(ac.yaw) * 68, y: 0.4, z: Math.cos(ac.yaw) * 68 };
    ms.currentGateIndex = 1;
    ms.gatesCleared = 1;
    ms.gates[0].cleared = true;
    ms.bannerText = ms.gates[1].label;
    ms.score = 420;
  } else if (shotName === 'cockpit') {
    // Lit Cockpit looking straight toward Solara runway & Beacon 6
    ac.pos = { x: -720, y: 178, z: 780 };
    ac.yaw = 2.42;
    ac.pitch = -0.02;
    ac.roll = 0.08;
    ac.throttle = 0.74;
    ac.airspeed = 66;
    ac.vel = { x: Math.sin(ac.yaw) * 66, y: -1.0, z: Math.cos(ac.yaw) * 66 };
    ms.currentGateIndex = 5;
    ms.gatesCleared = 5;
    for (let i = 0; i < 5; i += 1) ms.gates[i].cleared = true;
    ms.bannerText = ms.gates[5].label;
    ms.score = 1940;
  } else if (shotName === 'canyon') {
    // High-banked canyon carving toward Caldera Saddle gate
    ac.pos = { x: 610, y: 278, z: 1180 };
    ac.yaw = 0.68;
    ac.pitch = 0.04;
    ac.roll = 0.68;
    ac.throttle = 0.94;
    ac.airspeed = 86;
    ac.boosting = true;
    ac.vel = { x: Math.sin(ac.yaw) * 86, y: 2.0, z: Math.cos(ac.yaw) * 86 };
    ms.currentGateIndex = 3;
    ms.gatesCleared = 3;
    for (let i = 0; i < 3; i += 1) ms.gates[i].cleared = true;
    ms.bannerText = ms.gates[3].label;
    ms.score = 1280;
  } else if (shotName === 'landing') {
    // Short final approach into Solara Airfield with Gear Down and Flaps Deployed
    ac.pos = { x: 14, y: 84, z: -560 };
    ac.yaw = -0.03;
    ac.pitch = -0.04;
    ac.roll = 0.03;
    ac.gearDown = true;
    ac.gearDeploy = 1;
    ac.flaps = true;
    ac.throttle = 0.44;
    ac.airspeed = 47;
    ac.vel = { x: Math.sin(ac.yaw) * 47, y: -3.2, z: Math.cos(ac.yaw) * 47 };
    ms.runwayPhase = 'landing';
    ms.mission = { ...MISSIONS[1], title: 'Solara Final Approach', targetRunwayId: 'solara' };
    for (let i = 0; i < ms.gates.length; i += 1) ms.gates[i].cleared = true;
    ms.gatesCleared = 6;
    ms.bannerText = 'FINAL APPROACH // GEAR DOWN & FLAPS SET';
    ms.score = 2480;
  }

  const cam = createCameraState(ac);
  cam.mode = camMode;
  stepCamera(cam, ac, world, STEP, true);

  let simTime = 0;
  for (let i = 0; i < simSteps; i += 1) {
    simTime += STEP;
    const target = getActiveTarget(ms, world.runways);
    const desiredAlt = shotName === 'landing' ? 54 : target.y;
    const desiredSpd = shotName === 'landing' ? 46 : shotName === 'canyon' ? 88 : 68;
    const ctrl = autopilotToward(ac, target, desiredSpd, desiredAlt);
    if (shotName === 'chase' && i > simSteps - 40) {
      ctrl.roll = -0.65;
    }
    if (shotName === 'canyon' && i > simSteps - 45) {
      ctrl.roll = 0.85;
      ctrl.boost = true;
    }
    stepFlightPhysics(ac, ctrl, world, ms.mission, STEP, simTime);
    stepMissionState(ms, ac, STEP);
    stepCamera(cam, ac, world, STEP, false);
  }

  return { ac, ms, cam, simTime };
}
