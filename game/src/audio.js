// Procedural Web Audio synthesis for engine RPM, wind rush, stall warning, chimes, and touchdown.

export function createAudioEngine() {
  let ctx = null;
  let muted = false;
  let masterGain = null;
  let propOsc = null;
  let subOsc = null;
  let propGain = null;
  let windGain = null;
  let windFilter = null;
  let stallCooldown = 0;

  function ensureStarted() {
    if (ctx || muted) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    ctx = new AudioCtx();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.28;
    masterGain.connect(ctx.destination);

    // Dual-oscillator radial/propeller hum
    propGain = ctx.createGain();
    propGain.gain.value = 0.08;
    const propFilter = ctx.createBiquadFilter();
    propFilter.type = 'lowpass';
    propFilter.frequency.value = 260;

    propOsc = ctx.createOscillator();
    propOsc.type = 'sawtooth';
    propOsc.frequency.value = 54;
    subOsc = ctx.createOscillator();
    subOsc.type = 'triangle';
    subOsc.frequency.value = 27;

    propOsc.connect(propFilter);
    subOsc.connect(propFilter);
    propFilter.connect(propGain);
    propGain.connect(masterGain);
    propOsc.start();
    subOsc.start();

    // Filtered noise for canopy wind rush
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) data[i] = Math.random() * 2 - 1;

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuf;
    noiseSrc.loop = true;

    windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 420;
    windFilter.Q.value = 0.9;

    windGain = ctx.createGain();
    windGain.gain.value = 0.02;

    noiseSrc.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(masterGain);
    noiseSrc.start();
  }

  function playTone(freqStart, freqEnd, duration, type = 'sine', gainVal = 0.16) {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration);
    g.gain.setValueAtTime(gainVal, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(now);
    osc.stop(now + duration);
  }

  return {
    unlock() {
      ensureStarted();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    toggleMute() {
      muted = !muted;
      if (masterGain && ctx) {
        masterGain.gain.setTargetAtTime(muted ? 0 : 0.28, ctx.currentTime, 0.05);
      }
      return muted;
    },
    isMuted() {
      return muted;
    },
    updateFlight(ac, dt, active) {
      stallCooldown = Math.max(0, stallCooldown - dt);
      if (!ctx || muted) return;
      const now = ctx.currentTime;
      if (!active) {
        propGain.gain.setTargetAtTime(0.02, now, 0.1);
        windGain.gain.setTargetAtTime(0.01, now, 0.1);
        return;
      }
      const baseHz = 42 + ac.rpm * 64;
      propOsc.frequency.setTargetAtTime(baseHz, now, 0.06);
      subOsc.frequency.setTargetAtTime(baseHz * 0.5, now, 0.06);
      propGain.gain.setTargetAtTime(0.05 + ac.rpm * 0.11, now, 0.08);

      const windRatio = Math.min(1.4, ac.airspeed / 95);
      windFilter.frequency.setTargetAtTime(280 + windRatio * 680, now, 0.08);
      windGain.gain.setTargetAtTime(0.01 + windRatio * 0.08, now, 0.08);

      if (ac.stalling && stallCooldown <= 0) {
        stallCooldown = 0.65;
        playTone(680, 620, 0.16, 'square', 0.12);
      }
    },
    playGateChime() {
      playTone(587.33, 880, 0.22, 'triangle', 0.2);
      setTimeout(() => playTone(880, 1174.66, 0.26, 'sine', 0.18), 70);
    },
    playGearThump() {
      playTone(140, 58, 0.18, 'triangle', 0.22);
    },
    playTouchdown() {
      playTone(1200, 320, 0.14, 'sawtooth', 0.12);
    },
    playMissionComplete() {
      playTone(523.25, 659.25, 0.22, 'triangle', 0.22);
      setTimeout(() => playTone(659.25, 783.99, 0.24, 'triangle', 0.22), 120);
      setTimeout(() => playTone(783.99, 1046.5, 0.42, 'sine', 0.24), 250);
    },
    playImpact() {
      playTone(160, 42, 0.35, 'sawtooth', 0.32);
    },
  };
}
