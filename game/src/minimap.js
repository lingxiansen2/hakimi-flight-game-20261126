// Circular tactical mini-radar plotting island contours, runways, CVN-07 carrier, and active target bearing.

import { PALETTE, VIEWPORT } from './config.js';
import { getActiveTarget } from './missions.js';

const FONT_MONO = '"Cascadia Mono", "Consolas", ui-monospace, monospace';

const ISLAND_BLOBS = [
  { x: 0, z: 40, rx: 450, rz: 540 },
  { x: -340, z: 160, rx: 250, rz: 310 },
  { x: 965, z: 1620, rx: 520, rz: 520 },
  { x: -1040, z: 1120, rx: 370, rz: 350 },
  { x: 1460, z: -520, rx: 420, rz: 480 },
  { x: -1400, z: -1220, rx: 380, rz: 400 },
  { x: 150, z: 2880, rx: 540, rz: 490 },
];

export function drawTacticalMinimap(ctx, ac, ms, world, camMode, simTime) {
  const radius = camMode === 'cockpit' ? 54 : 62;
  const cx = camMode === 'cockpit' ? 104 : VIEWPORT.width - 96;
  const cy = camMode === 'cockpit' ? 108 : 108;
  const rangeMeters = 2400;
  const scale = radius / rangeMeters;

  ctx.save();
  // Outer machined radar bezel
  const rimGrad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
  rimGrad.addColorStop(0, '#3b495e');
  rimGrad.addColorStop(1, '#101824');
  ctx.fillStyle = rimGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(94, 234, 212, 0.45)';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // Scope screen background
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(7, 17, 29, 0.88)';
  ctx.fill();
  ctx.clip();

  // Range rings & crosshairs
  ctx.strokeStyle = 'rgba(94, 234, 212, 0.16)';
  ctx.lineWidth = 1;
  for (const frac of [0.35, 0.7]) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius * frac, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx - radius, cy);
  ctx.lineTo(cx + radius, cy);
  ctx.moveTo(cx, cy - radius);
  ctx.lineTo(cx, cy + radius);
  ctx.stroke();

  // Rotating heading-up world projection
  const sy = Math.sin(ac.yaw);
  const cyaw = Math.cos(ac.yaw);
  const toScope = (wx, wz) => {
    const dx = wx - ac.pos.x;
    const dz = wz - ac.pos.z;
    // Right relative to aircraft nose = dx * cyaw - dz * syaw; Forward = dx * syaw + dz * cyaw
    const rx = (dx * cyaw - dz * sy) * scale;
    const fz = (dx * sy + dz * cyaw) * scale;
    return { x: cx + rx, y: cy - fz };
  };

  // Island terrain contours
  ctx.fillStyle = 'rgba(52, 145, 92, 0.42)';
  ctx.strokeStyle = 'rgba(94, 234, 212, 0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i < ISLAND_BLOBS.length; i += 1) {
    const isl = ISLAND_BLOBS[i];
    const p = toScope(isl.x, isl.z);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, isl.rx * scale, isl.rz * scale, ac.yaw, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Runways & CVN-07 Carrier ticks
  for (let i = 0; i < world.runways.length; i += 1) {
    const r = world.runways[i];
    const p = toScope(r.x, r.z);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(r.yaw - ac.yaw);
    ctx.fillStyle = r.isCarrier ? PALETTE.hudAmber : '#e2e8f0';
    ctx.fillRect(-2.5, -r.length * scale * 0.5, 5, Math.max(6, r.length * scale));
    ctx.restore();
  }

  // Active target line & pulsing marker
  const target = getActiveTarget(ms, world.runways);
  const tp = toScope(target.x, target.z);
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.65)';
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(tp.x, tp.y);
  ctx.stroke();
  ctx.setLineDash([]);

  const pingR = 3.5 + 1.5 * Math.sin(simTime * 5);
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.beginPath();
  ctx.arc(tp.x, tp.y, pingR, 0, Math.PI * 2);
  ctx.fill();

  // Radar sweep beam
  const sweepAng = (simTime * 1.4) % (Math.PI * 2);
  ctx.strokeStyle = 'rgba(94, 234, 212, 0.32)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(sweepAng) * radius, cy + Math.sin(sweepAng) * radius);
  ctx.stroke();

  // Player chevron at center
  ctx.fillStyle = PALETTE.hudCyan;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 6);
  ctx.lineTo(cx - 4.5, cy + 4);
  ctx.lineTo(cx + 4.5, cy + 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Scope label pill
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(cx - 34, cy + radius + 5, 68, 16, 4);
  ctx.fillStyle = 'rgba(9, 17, 29, 0.82)';
  ctx.fill();
  ctx.fillStyle = '#5eead4';
  ctx.font = `700 9.5px ${FONT_MONO}`;
  ctx.textAlign = 'center';
  ctx.fillText('TAC RADAR', cx, cy + radius + 16);
  ctx.restore();
}
