// Game bootstrap, fixed-timestep loop, WebGL2 + Canvas2D HUD orchestration, and deterministic shot mode.

import { CAMERA_MODES, MISSIONS, STEP, STORAGE_KEY, VIEWPORT } from './config.js';
import { createWorld } from './world.js';
import { createAircraftState, stepFlightPhysics } from './physics.js';
import { createMissionState, stepMissionState } from './missions.js';
import { createCameraState, stepCamera } from './camera.js';
import { createRenderer } from './renderer.js';
import { createHudRenderer } from './hud.js';
import { createInputController } from './input.js';
import { createAudioEngine } from './audio.js';
import { stageShotScene } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotParam = params.get('shot');

const glCanvas = document.getElementById('gl-canvas');
const hudCanvas = document.getElementById('hud-canvas');
glCanvas.width = VIEWPORT.width;
glCanvas.height = VIEWPORT.height;
hudCanvas.width = VIEWPORT.width;
hudCanvas.height = VIEWPORT.height;

const world = createWorld();
const renderer = createRenderer(glCanvas, world);
const hud = createHudRenderer(hudCanvas);

function runShotMode(shotName) {
  const uiOverlay = document.getElementById('ui-overlay');
  if (uiOverlay) uiOverlay.classList.add('hidden');
  const { ac, ms, cam, simTime } = stageShotScene(shotName, world);

  let painted = 0;
  function paint() {
    const proj = renderer.drawScene(world, ac, cam, ms, simTime);
    hud.drawHud(ac, ms, world, cam, proj, simTime, true);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function readRecords() {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') || {};
  } catch {
    return {};
  }
}

function saveRecord(missionId, score) {
  try {
    const recs = readRecords();
    if (!recs[missionId] || score > recs[missionId]) {
      recs[missionId] = score;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(recs));
    }
  } catch {
    // Ignore storage unavailability
  }
}

function runInteractiveGame() {
  const input = createInputController(glCanvas);
  const audio = createAudioEngine();

  const ariaStatus = document.getElementById('aria-status');
  const titleModal = document.getElementById('title-modal');
  const pauseModal = document.getElementById('pause-modal');
  const debriefModal = document.getElementById('debrief-modal');
  const missionListEl = document.getElementById('mission-list');
  const topBar = document.getElementById('top-bar');
  const launchBtn = document.getElementById('launch-btn');
  const resumeBtn = document.getElementById('resume-btn');
  const restartBtn = document.getElementById('restart-btn');
  const menuBtn = document.getElementById('menu-btn');
  const debriefRetryBtn = document.getElementById('debrief-retry-btn');
  const debriefMenuBtn = document.getElementById('debrief-menu-btn');
  const camToggleBtn = document.getElementById('cam-toggle-btn');
  const muteToggleBtn = document.getElementById('mute-toggle-btn');
  const pauseToggleBtn = document.getElementById('pause-toggle-btn');

  let selectedMissionIndex = 0;
  let screen = 'title';
  let ac = createAircraftState(MISSIONS[0]);
  let ms = createMissionState(MISSIONS[0]);
  let cam = createCameraState(ac);
  cam.mode = 'orbit';
  let simTime = 0;
  let accumulator = 0;
  let lastNow = performance.now();

  function announce(msg) {
    if (ariaStatus) ariaStatus.textContent = msg;
  }

  function syncUiVisibility() {
    titleModal.classList.toggle('hidden', screen !== 'title');
    pauseModal.classList.toggle('hidden', screen !== 'paused');
    debriefModal.classList.toggle('hidden', screen !== 'debrief');
    topBar.classList.toggle('hidden', screen === 'title');
  }

  function renderMissionButtons() {
    const recs = readRecords();
    missionListEl.innerHTML = '';
    MISSIONS.forEach((m, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `mission-card${idx === selectedMissionIndex ? ' active' : ''}`;
      const bestStr = recs[m.id] ? `BEST ${recs[m.id]}` : m.gates.length > 0 ? `${m.gates.length} GATES` : 'OPEN SKY';
      btn.innerHTML = `<div class="m-head"><strong>${m.title}</strong><span>${bestStr}</span></div><p>${m.subtitle}</p>`;
      btn.addEventListener('click', () => {
        selectedMissionIndex = idx;
        renderMissionButtons();
        ac = createAircraftState(MISSIONS[idx]);
        ms = createMissionState(MISSIONS[idx]);
        cam = createCameraState(ac);
        cam.mode = 'orbit';
        stepCamera(cam, ac, world, STEP, true);
      });
      missionListEl.appendChild(btn);
    });
  }

  function startSortie(idx = selectedMissionIndex) {
    audio.unlock();
    const mission = MISSIONS[idx];
    ac = createAircraftState(mission);
    ms = createMissionState(mission);
    cam = createCameraState(ac);
    cam.mode = 'chase';
    stepCamera(cam, ac, world, STEP, true);
    simTime = 0;
    accumulator = 0;
    screen = 'play';
    camToggleBtn.textContent = '[V] CAM: CHASE';
    syncUiVisibility();
    announce(`Sortie launched: ${mission.title}`);
  }

  function openDebrief(success) {
    screen = 'debrief';
    if (success) saveRecord(ms.mission.id, ms.score);
    const titleEl = document.getElementById('debrief-title');
    const summaryEl = document.getElementById('debrief-summary');
    const statsEl = document.getElementById('debrief-stats');
    titleEl.textContent = success ? `SORTIE COMPLETE // ${ms.grade}` : 'AIRFRAME LOST';
    summaryEl.textContent = success
      ? `${ms.touchdownGrade} touchdown at ${ac.onRunway?.name ?? 'airfield'}. Hull ${Math.round(ac.hull)}%, Fuel ${Math.round(ac.fuel)}%.`
      : `${ac.crashReason}. Maintain airspeed above 55 KTS and extend gear [G] before touchdown.`;
    const mm = String(Math.floor(ms.elapsed / 60)).padStart(2, '0');
    const ss = String(Math.floor(ms.elapsed % 60)).padStart(2, '0');
    statsEl.innerHTML = `
      <div><span>SCORE</span><strong>${ms.score}</strong></div>
      <div><span>TIME</span><strong>${mm}:${ss}</strong></div>
      <div><span>TOUCHDOWN</span><strong>${ac.lastTouchdownGrade || 'N/A'}</strong></div>
      <div><span>HULL</span><strong>${Math.round(ac.hull)}%</strong></div>
    `;
    syncUiVisibility();
    announce(titleEl.textContent);
  }

  function cycleCamera() {
    const idx = (CAMERA_MODES.indexOf(cam.mode) + 1) % CAMERA_MODES.length;
    cam.mode = CAMERA_MODES[idx];
    camToggleBtn.textContent = `[V] CAM: ${cam.mode.toUpperCase()}`;
  }

  launchBtn.addEventListener('click', () => startSortie());
  resumeBtn.addEventListener('click', () => { screen = 'play'; syncUiVisibility(); });
  restartBtn.addEventListener('click', () => startSortie());
  menuBtn.addEventListener('click', () => {
    screen = 'title';
    cam.mode = 'orbit';
    renderMissionButtons();
    syncUiVisibility();
  });
  debriefRetryBtn.addEventListener('click', () => startSortie());
  debriefMenuBtn.addEventListener('click', () => {
    screen = 'title';
    cam.mode = 'orbit';
    renderMissionButtons();
    syncUiVisibility();
  });
  camToggleBtn.addEventListener('click', () => cycleCamera());
  muteToggleBtn.addEventListener('click', () => {
    const muted = audio.toggleMute();
    muteToggleBtn.textContent = muted ? '[M] AUDIO: OFF' : '[M] AUDIO: ON';
  });
  pauseToggleBtn.addEventListener('click', () => {
    if (screen === 'play') screen = 'paused';
    else if (screen === 'paused') screen = 'play';
    syncUiVisibility();
  });

  function stepSimulation(controls) {
    simTime += STEP;
    if (screen === 'title') {
      const autoCtrl = {
        roll: Math.sin(simTime * 0.35) * 0.25,
        pitch: Math.cos(simTime * 0.25) * 0.08,
        yaw: 0.08,
        throttleDelta: 0,
        toggleFlaps: false,
        toggleGear: false,
        airbrake: false,
        boost: false,
      };
      stepFlightPhysics(ac, autoCtrl, world, ms.mission, STEP, simTime);
      stepCamera(cam, ac, world, STEP, false);
      return;
    }

    const physEvents = stepFlightPhysics(ac, controls, world, ms.mission, STEP, simTime);
    const missEvents = stepMissionState(ms, ac, STEP);
    stepCamera(cam, ac, world, STEP, false);

    if (controls.toggleGear) audio.playGearThump();
    if (physEvents.gearChirp) audio.playTouchdown();
    if (missEvents.gateCleared) audio.playGateChime();
    if (missEvents.missionComplete) {
      audio.playMissionComplete();
      openDebrief(true);
    } else if (physEvents.crashed) {
      audio.playImpact();
      openDebrief(false);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - lastNow) / 1000, 0.2);
    lastNow = now;

    const controls = input.pollControls();
    if (controls.toggleMute) {
      const muted = audio.toggleMute();
      muteToggleBtn.textContent = muted ? '[M] AUDIO: OFF' : '[M] AUDIO: ON';
    }
    if (controls.toggleCamera && screen === 'play') cycleCamera();
    if (controls.togglePause && (screen === 'play' || screen === 'paused')) {
      screen = screen === 'play' ? 'paused' : 'play';
      syncUiVisibility();
    }
    if (controls.confirm && (screen === 'title' || screen === 'debrief')) startSortie();

    if (screen === 'play' || screen === 'title') {
      accumulator += dt;
      while (accumulator >= STEP) {
        stepSimulation(controls);
        accumulator -= STEP;
        controls.toggleFlaps = false;
        controls.toggleGear = false;
      }
    } else {
      accumulator = 0;
    }

    audio.updateFlight(ac, dt, screen === 'play');
    const proj = renderer.drawScene(world, ac, cam, ms, simTime);
    hud.drawHud(ac, ms, world, cam, proj, simTime, screen === 'play');
  }

  renderMissionButtons();
  syncUiVisibility();
  stepCamera(cam, ac, world, STEP, true);
  requestAnimationFrame(frame);
}

if (shotParam) runShotMode(shotParam);
else runInteractiveGame();
