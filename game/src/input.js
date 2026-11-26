// Unified keyboard and optional mouse-yoke input controller for flight controls.

import { clamp } from './math3d.js';

export function createInputController(canvas) {
  const keys = new Set();
  const pending = {
    toggleCamera: false,
    toggleFlaps: false,
    toggleGear: false,
    toggleMute: false,
    togglePause: false,
    toggleMouseYoke: false,
    confirm: false,
  };

  let mouseYokeActive = false;
  let mouseNormX = 0;
  let mouseNormY = 0;

  const TOGGLE_MAP = {
    KeyV: 'toggleCamera',
    KeyF: 'toggleFlaps',
    KeyG: 'toggleGear',
    KeyM: 'toggleMute',
    KeyP: 'togglePause',
    Escape: 'togglePause',
    KeyC: 'toggleMouseYoke',
    Space: 'confirm',
    Enter: 'confirm',
  };

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (!e.repeat && TOGGLE_MAP[e.code]) {
      pending[TOGGLE_MAP[e.code]] = true;
    }
    keys.add(e.code);
  });

  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
  });

  window.addEventListener('blur', () => {
    keys.clear();
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    mouseNormX = clamp(((e.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
    mouseNormY = clamp(((e.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
  });

  return {
    pollControls() {
      if (pending.toggleMouseYoke) {
        mouseYokeActive = !mouseYokeActive;
        pending.toggleMouseYoke = false;
      }

      let roll = 0;
      if (keys.has('ArrowLeft') || keys.has('KeyA')) roll -= 1;
      if (keys.has('ArrowRight') || keys.has('KeyD')) roll += 1;

      let pitch = 0;
      if (keys.has('ArrowDown')) pitch += 1; // pull back -> nose up
      if (keys.has('ArrowUp')) pitch -= 1;   // push forward -> nose down

      if (mouseYokeActive && roll === 0 && pitch === 0) {
        const dead = 0.08;
        roll = Math.abs(mouseNormX) > dead ? mouseNormX : 0;
        pitch = Math.abs(mouseNormY) > dead ? mouseNormY : 0;
      }

      let yaw = 0;
      if (keys.has('KeyQ')) yaw -= 1;
      if (keys.has('KeyE')) yaw += 1;

      let throttleDelta = 0;
      if (keys.has('KeyW') || keys.has('Equal')) throttleDelta += 1;
      if (keys.has('KeyS') || keys.has('Minus')) throttleDelta -= 1;

      const actions = {
        toggleCamera: pending.toggleCamera,
        toggleFlaps: pending.toggleFlaps,
        toggleGear: pending.toggleGear,
        toggleMute: pending.toggleMute,
        togglePause: pending.togglePause,
        confirm: pending.confirm,
        mouseYokeActive,
        roll,
        pitch,
        yaw,
        throttleDelta,
        airbrake: keys.has('KeyB'),
        boost: keys.has('ShiftLeft') || keys.has('ShiftRight'),
      };

      pending.toggleCamera = false;
      pending.toggleFlaps = false;
      pending.toggleGear = false;
      pending.toggleMute = false;
      pending.togglePause = false;
      pending.confirm = false;

      return actions;
    },
    isMouseYokeActive() {
      return mouseYokeActive;
    },
  };
}
