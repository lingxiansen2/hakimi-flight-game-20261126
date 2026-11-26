// Beveled 6-dial cockpit instrument panel, collimated HUD combiner glass, storm rain, and chase HUD.

import { PALETTE, VIEWPORT } from './config.js';
import { clamp, wrapAngle } from './math3d.js';
import { getActiveTarget } from './missions.js';
import { drawTacticalMinimap } from './minimap.js';

const FONT_MONO = '"Cascadia Mono", "Consolas", ui-monospace, monospace';
const FONT_SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Draw an authentic beveled dark-anodized circular flight instrument dial. */
function drawBeveledDial(ctx, cx, cy, radius, title, valueText, needleAngle, accentColor, subText = '', arcOpts = null) {
  ctx.save();
  // Outer machined metallic flange with screw heads
  const bezelGrad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
  bezelGrad.addColorStop(0, '#3a4659');
  bezelGrad.addColorStop(0.5, '#1d2531');
  bezelGrad.addColorStop(1, '#0e131b');
  ctx.fillStyle = bezelGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#526277';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Corner mounting rivets
  for (const [rx, ry] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.arc(cx + rx * (radius * 0.86), cy + ry * (radius * 0.86), 2.1, 0, Math.PI * 2);
    ctx.fill();
  }

  // Deep recessed dial face
  const faceGrad = ctx.createRadialGradient(cx, cy - radius * 0.2, 4, cx, cy, radius);
  faceGrad.addColorStop(0, '#131d2b');
  faceGrad.addColorStop(1, '#060a10');
  ctx.fillStyle = faceGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  // Optional colored operating range arcs (green/amber/red)
  if (arcOpts) {
    for (const seg of arcOpts) {
      ctx.strokeStyle = seg.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, radius - 5, seg.start, seg.end);
      ctx.stroke();
    }
  }

  // Crisp graduated ticks
  for (let i = 0; i < 24; i += 1) {
    const a = (i / 24) * Math.PI * 2 - Math.PI * 0.5;
    const major = i % 2 === 0;
    const rIn = radius * (major ? 0.74 : 0.83);
    ctx.strokeStyle = major ? '#cbd5e1' : '#475569';
    ctx.lineWidth = major ? 1.8 : 1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * rIn, cy + Math.sin(a) * rIn);
    ctx.lineTo(cx + Math.cos(a) * (radius - 6), cy + Math.sin(a) * (radius - 6));
    ctx.stroke();
  }

  ctx.fillStyle = '#94a3b8';
  ctx.font = `700 9.5px ${FONT_MONO}`;
  ctx.textAlign = 'center';
  ctx.fillText(title, cx, cy - radius * 0.42);

  ctx.fillStyle = accentColor;
  ctx.font = `800 14px ${FONT_MONO}`;
  ctx.fillText(valueText, cx, cy + radius * 0.44);

  if (subText) {
    ctx.fillStyle = '#cbd5e1';
    ctx.font = `600 9.5px ${FONT_MONO}`;
    ctx.fillText(subText, cx, cy + radius * 0.67);
  }

  // Luminous pointer needle with counterweight
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(cx - Math.cos(needleAngle) * (radius * 0.18), cy - Math.sin(needleAngle) * (radius * 0.18));
  ctx.lineTo(cx + Math.cos(needleAngle) * (radius * 0.76), cy + Math.sin(needleAngle) * (radius * 0.76));
  ctx.stroke();

  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.arc(cx, cy, 4.2, 0, Math.PI * 2);
  ctx.fill();

  // Subtle glass sheen arc
  ctx.strokeStyle = 'rgba(226, 240, 255, 0.10)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 2, -Math.PI * 0.85, -Math.PI * 0.15);
  ctx.stroke();
  ctx.restore();
}

function drawAttitudeSphere(ctx, cx, cy, radius, pitch, roll) {
  ctx.save();
  const bezelGrad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
  bezelGrad.addColorStop(0, '#3a4659');
  bezelGrad.addColorStop(1, '#0e131b');
  ctx.fillStyle = bezelGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#526277';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-roll);
  const pOff = clamp(pitch * 58, -radius * 0.85, radius * 0.85);
  const skyG = ctx.createLinearGradient(0, -radius, 0, pOff);
  skyG.addColorStop(0, '#0f4c81');
  skyG.addColorStop(1, '#2b82c9');
  ctx.fillStyle = skyG;
  ctx.fillRect(-radius * 1.6, -radius * 2 + pOff, radius * 3.2, radius * 2);

  const gndG = ctx.createLinearGradient(0, pOff, 0, pOff + radius);
  gndG.addColorStop(0, '#8a5228');
  gndG.addColorStop(1, '#4b2a13');
  ctx.fillStyle = gndG;
  ctx.fillRect(-radius * 1.6, pOff, radius * 3.2, radius * 2);

  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-radius, pOff);
  ctx.lineTo(radius, pOff);
  ctx.stroke();

  for (const deg of [-20, -10, 10, 20]) {
    const py = pOff - ((deg * Math.PI) / 180) * 58;
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.8)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-16, py);
    ctx.lineTo(16, py);
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = PALETTE.hudAmber;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 24, cy);
  ctx.lineTo(cx - 8, cy);
  ctx.lineTo(cx - 8, cy + 5);
  ctx.moveTo(cx + 24, cy);
  ctx.lineTo(cx + 8, cy);
  ctx.lineTo(cx + 8, cy + 5);
  ctx.stroke();
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function createHudRenderer(hudCanvas) {
  const ctx = hudCanvas.getContext('2d');

  function drawStormRain(storm, simTime) {
    if (storm <= 0.15) return;
    ctx.save();
    ctx.strokeStyle = `rgba(205, 228, 248, ${(0.22 * storm).toFixed(2)})`;
    ctx.lineWidth = 1.4;
    const count = Math.round(70 * storm);
    for (let i = 0; i < count; i += 1) {
      const seed = (i * 197.3) % 1;
      const sx = ((seed * 1400 + simTime * 620 + i * 73) % 1360) - 40;
      const sy = ((i * 89 + simTime * 1150) % 780) - 30;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - 12, sy + 32);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawCockpitFrameAndCombiner(ac, storm, simTime) {
    const w = VIEWPORT.width;
    const h = VIEWPORT.height;

    drawStormRain(storm, simTime);

    ctx.save();
    // Canopy struts & side window mullions
    ctx.strokeStyle = '#151d28';
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.moveTo(0, 530);
    ctx.lineTo(180, 96);
    ctx.quadraticCurveTo(w * 0.5, 16, w - 180, 96);
    ctx.lineTo(w, 530);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(138, 174, 210, 0.28)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(15, 530);
    ctx.lineTo(188, 102);
    ctx.quadraticCurveTo(w * 0.5, 24, w - 188, 102);
    ctx.lineTo(w - 15, 530);
    ctx.stroke();

    // Collimated green HUD combiner glass mounted above glare shield
    const cx = w * 0.5;
    roundRectPath(ctx, cx - 165, 195, 330, 260, 18);
    ctx.fillStyle = 'rgba(20, 184, 166, 0.05)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(94, 234, 212, 0.42)';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Combiner mounting brackets
    ctx.fillStyle = '#1b2432';
    ctx.fillRect(cx - 172, 444, 26, 86);
    ctx.fillRect(cx + 146, 444, 26, 86);

    // Subtle crimson cowling nose peeking below combiner
    const pitchLift = clamp(ac.pitch * 36, -12, 16);
    ctx.fillStyle = '#a82821';
    ctx.beginPath();
    ctx.moveTo(cx - 110, 526);
    ctx.lineTo(cx - 56, 488 + pitchLift);
    ctx.lineTo(cx + 56, 488 + pitchLift);
    ctx.lineTo(cx + 110, 526);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function drawPitchLadder(ac, targetBearingRad, isCockpit) {
    const cx = VIEWPORT.width * 0.5;
    const cy = isCockpit ? 326 : VIEWPORT.height * 0.5;

    ctx.save();
    if (isCockpit) {
      roundRectPath(ctx, cx - 160, 200, 320, 250, 14);
      ctx.clip();
    }
    ctx.translate(cx, cy);
    ctx.rotate(-ac.roll);

    const pxPerRad = 290;
    const pitchOffset = ac.pitch * pxPerRad;
    ctx.strokeStyle = isCockpit ? 'rgba(74, 222, 128, 0.85)' : 'rgba(94, 234, 212, 0.72)';
    ctx.fillStyle = isCockpit ? 'rgba(74, 222, 128, 0.92)' : 'rgba(94, 234, 212, 0.88)';
    ctx.font = `700 10.5px ${FONT_MONO}`;

    for (let deg = -20; deg <= 20; deg += 10) {
      if (deg === 0) {
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-88, pitchOffset);
        ctx.lineTo(-24, pitchOffset);
        ctx.moveTo(24, pitchOffset);
        ctx.lineTo(88, pitchOffset);
        ctx.stroke();
        continue;
      }
      const y = pitchOffset - ((deg * Math.PI) / 180) * pxPerRad;
      if (Math.abs(y) > 135) continue;
      ctx.lineWidth = 1.4;
      if (deg < 0) ctx.setLineDash([6, 4]);
      else ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(-54, y);
      ctx.lineTo(-18, y);
      ctx.moveTo(18, y);
      ctx.lineTo(54, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.textAlign = 'right';
      ctx.fillText(String(deg), -59, y + 4);
      ctx.textAlign = 'left';
      ctx.fillText(String(deg), 59, y + 4);
    }
    ctx.restore();

    // Fixed boresight reticle
    ctx.save();
    ctx.strokeStyle = isCockpit ? PALETTE.hudGreen : PALETTE.hudCyan;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 16, cy);
    ctx.lineTo(cx - 5, cy);
    ctx.lineTo(cx, cy + 5);
    ctx.lineTo(cx + 5, cy);
    ctx.lineTo(cx + 16, cy);
    ctx.stroke();

    const relHeading = wrapAngle(targetBearingRad - ac.yaw);
    const bugX = clamp(cx + Math.sin(relHeading) * 130, cx - 150, cx + 150);
    ctx.fillStyle = PALETTE.hudAmber;
    ctx.beginPath();
    ctx.moveTo(bugX, cy - 104);
    ctx.lineTo(bugX - 5, cy - 114);
    ctx.lineTo(bugX + 5, cy - 114);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawTopCompass(ac, targetBearingRad) {
    const cx = VIEWPORT.width * 0.5;
    const width = 340;
    const x0 = cx - width * 0.5;
    const y0 = 14;

    ctx.save();
    roundRectPath(ctx, x0, y0, width, 40, 8);
    ctx.fillStyle = 'rgba(9, 16, 28, 0.78)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(94, 234, 212, 0.36)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    const hdgDeg = ((ac.yaw * 180) / Math.PI + 360) % 360;
    const targetDeg = ((targetBearingRad * 180) / Math.PI + 360) % 360;

    ctx.beginPath();
    ctx.rect(x0 + 8, y0, width - 16, 40);
    ctx.clip();

    const pxPerDeg = 3.2;
    const labels = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
    ctx.font = `700 11px ${FONT_MONO}`;
    ctx.textAlign = 'center';

    for (let d = -60; d <= 60; d += 5) {
      const tickDeg = Math.round(hdgDeg / 5) * 5 + d;
      const normDeg = ((tickDeg % 360) + 360) % 360;
      const sx = cx + (tickDeg - hdgDeg) * pxPerDeg;
      const isMajor = normDeg % 15 === 0;
      ctx.strokeStyle = isMajor ? 'rgba(226, 232, 240, 0.85)' : 'rgba(148, 163, 184, 0.45)';
      ctx.lineWidth = isMajor ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(sx, y0 + 27);
      ctx.lineTo(sx, y0 + (isMajor ? 37 : 33));
      ctx.stroke();
      if (isMajor) {
        ctx.fillStyle = labels[normDeg] ? PALETTE.hudCyan : '#cbd5e1';
        ctx.fillText(labels[normDeg] ?? String(normDeg).padStart(3, '0'), sx, y0 + 21);
      }
    }

    const diff = ((targetDeg - hdgDeg + 540) % 360) - 180;
    const tx = clamp(cx + diff * pxPerDeg, x0 + 16, x0 + width - 16);
    ctx.fillStyle = PALETTE.hudAmber;
    ctx.beginPath();
    ctx.moveTo(tx, y0 + 29);
    ctx.lineTo(tx - 5, y0 + 35);
    ctx.lineTo(tx + 5, y0 + 35);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    roundRectPath(ctx, cx - 28, y0 + 42, 56, 20, 4);
    ctx.fillStyle = 'rgba(9, 17, 29, 0.92)';
    ctx.fill();
    ctx.strokeStyle = PALETTE.hudCyan;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = PALETTE.hudInk;
    ctx.font = `700 12px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText(`${String(Math.round(hdgDeg) % 360).padStart(3, '0')}°`, cx, y0 + 56);
    ctx.restore();
  }

  function drawSideTapes(ac) {
    const cy = VIEWPORT.height * 0.5 - 24;
    const kts = Math.round(ac.airspeed * 1.94384);
    const altFt = Math.round(ac.pos.y * 3.28084);
    const aglFt = Math.round(ac.agl * 3.28084);
    const vsiFpm = Math.round(ac.verticalSpeed * 196.85);

    ctx.save();
    roundRectPath(ctx, 24, cy - 82, 126, 168, 10);
    ctx.fillStyle = 'rgba(9, 17, 29, 0.78)';
    ctx.fill();
    ctx.strokeStyle = ac.stalling ? PALETTE.hudRed : 'rgba(94, 234, 212, 0.36)';
    ctx.lineWidth = 1.3;
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = `700 10px ${FONT_MONO}`;
    ctx.textAlign = 'left';
    ctx.fillText('AIRSPEED', 36, cy - 60);
    ctx.fillStyle = ac.stalling ? PALETTE.hudRed : PALETTE.hudInk;
    ctx.font = `800 30px ${FONT_MONO}`;
    ctx.fillText(String(kts), 36, cy - 24);
    ctx.fillStyle = PALETTE.hudCyan;
    ctx.font = `700 11px ${FONT_MONO}`;
    ctx.fillText('KTS', 105, cy - 24);

    ctx.fillStyle = 'rgba(148, 163, 184, 0.22)';
    ctx.fillRect(36, cy - 6, 102, 7);
    ctx.fillStyle = ac.stalling ? PALETTE.hudRed : ac.boosting ? PALETTE.hudAmber : PALETTE.hudCyan;
    ctx.fillRect(36, cy - 6, 102 * clamp(ac.airspeed / 122, 0, 1), 7);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = `600 11px ${FONT_MONO}`;
    ctx.fillText(`G-LOAD  ${ac.gLoad.toFixed(1)}G`, 36, cy + 24);
    ctx.fillText(`THROT  ${Math.round(ac.throttle * 100)}%`, 36, cy + 44);
    ctx.fillText(`AOA   ${Math.round((ac.aoa * 180) / Math.PI)}°`, 36, cy + 64);
    ctx.restore();

    const rx = VIEWPORT.width - 154;
    ctx.save();
    roundRectPath(ctx, rx, cy - 82, 130, 168, 10);
    ctx.fillStyle = 'rgba(9, 17, 29, 0.78)';
    ctx.fill();
    ctx.strokeStyle = ac.agl < 25 && !ac.onGround ? PALETTE.hudAmber : 'rgba(94, 234, 212, 0.36)';
    ctx.lineWidth = 1.3;
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = `700 10px ${FONT_MONO}`;
    ctx.textAlign = 'left';
    ctx.fillText('ALTITUDE MSL', rx + 12, cy - 60);
    ctx.fillStyle = PALETTE.hudInk;
    ctx.font = `800 28px ${FONT_MONO}`;
    ctx.fillText(String(altFt), rx + 12, cy - 26);
    ctx.fillStyle = PALETTE.hudCyan;
    ctx.font = `700 11px ${FONT_MONO}`;
    ctx.fillText('FT', rx + 104, cy - 26);

    ctx.fillStyle = ac.agl < 80 ? PALETTE.hudAmber : '#cbd5e1';
    ctx.font = `600 11px ${FONT_MONO}`;
    ctx.fillText(`RADAR  ${aglFt} FT`, rx + 12, cy + 14);
    const vsiSign = vsiFpm >= 0 ? '+' : '';
    ctx.fillStyle = vsiFpm < -900 ? PALETTE.hudAmber : '#cbd5e1';
    ctx.fillText(`VSI ${vsiSign}${vsiFpm}`, rx + 12, cy + 36);

    const vsiNorm = clamp(vsiFpm / 2000, -1, 1);
    ctx.fillStyle = 'rgba(148, 163, 184, 0.22)';
    ctx.fillRect(rx + 12, cy + 52, 106, 7);
    ctx.fillStyle = vsiNorm >= 0 ? PALETTE.hudGreen : PALETTE.hudAmber;
    if (vsiNorm >= 0) ctx.fillRect(rx + 65, cy + 52, 53 * vsiNorm, 7);
    else ctx.fillRect(rx + 65 + 53 * vsiNorm, cy + 52, -53 * vsiNorm, 7);
    ctx.restore();
  }

  function drawCockpitPanel(ac, ms, world) {
    const w = VIEWPORT.width;
    const h = VIEWPORT.height;
    const panelY = 524;

    ctx.save();
    const deckGrad = ctx.createLinearGradient(0, panelY, 0, h);
    deckGrad.addColorStop(0, '#2a3647');
    deckGrad.addColorStop(0.06, '#182230');
    deckGrad.addColorStop(0.65, '#111824');
    deckGrad.addColorStop(1, '#070b11');
    ctx.fillStyle = deckGrad;
    ctx.beginPath();
    ctx.moveTo(0, panelY + 26);
    ctx.quadraticCurveTo(w * 0.5, panelY - 14, w, panelY + 26);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    // Brushed metal horizontal grain & machined panel seams + hex rivets
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let y = panelY; y < h; y += 3) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.lineWidth = 2;
    for (const sx of [310, 722, 998]) {
      ctx.beginPath();
      ctx.moveTo(sx, panelY);
      ctx.lineTo(sx, h);
      ctx.stroke();
    }
    ctx.fillStyle = '#64748b';
    for (const rx of [22, 300, 320, 712, 732, 988, 1008, w - 22]) {
      for (const ry of [558, 704]) {
        ctx.beginPath();
        ctx.arc(rx, ry, 2.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    ctx.strokeStyle = '#526277';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(0, panelY + 26);
    ctx.quadraticCurveTo(w * 0.5, panelY - 14, w, panelY + 26);
    ctx.stroke();

    const kts = Math.round(ac.airspeed * 1.94384);
    const altFt = Math.round(ac.pos.y * 3.28084);
    const vsiFpm = Math.round(ac.verticalSpeed * 196.85);
    const hdgDeg = Math.round(((ac.yaw * 180) / Math.PI + 360) % 360) % 360;
    const target = getActiveTarget(ms, world.runways);
    const bearing = Math.atan2(target.x - ac.pos.x, target.z - ac.pos.z);
    const relBearing = wrapAngle(bearing - ac.yaw);

    // 5 Beveled Analog-Digital Dials + 6th Engine/Systems MFD + Nav Strip (Zero overlap!)
    drawBeveledDial(
      ctx, 102, 628, 58, 'AIRSPEED', `${kts}`,
      -Math.PI * 0.8 + clamp(kts / 240, 0, 1) * Math.PI * 1.6, PALETTE.hudCyan, 'KTS',
      [
        { start: -Math.PI * 0.5, end: Math.PI * 0.35, color: 'rgba(74, 222, 128, 0.45)' },
        { start: Math.PI * 0.35, end: Math.PI * 0.72, color: 'rgba(248, 113, 113, 0.55)' },
      ],
    );
    drawAttitudeSphere(ctx, 240, 624, 62, ac.pitch, ac.roll);
    drawBeveledDial(ctx, 378, 628, 58, 'ALTIMETER', `${altFt}`, -Math.PI * 0.5 + (altFt / 1000) * Math.PI * 2, PALETTE.hudGreen, `AGL ${Math.round(ac.agl * 3.28)}F`);
    drawBeveledDial(ctx, 516, 628, 58, 'HSI COMPASS', `${String(hdgDeg).padStart(3, '0')}°`, -Math.PI * 0.5 + relBearing, PALETTE.hudAmber, 'WAYPOINT');
    drawBeveledDial(ctx, 654, 628, 58, 'VSI CLIMB', `${vsiFpm >= 0 ? '+' : ''}${vsiFpm}`, Math.PI + clamp(vsiFpm / 3000, -1, 1) * Math.PI * 0.72, vsiFpm < -900 ? PALETTE.hudAmber : PALETTE.hudCyan, 'FPM');

    // 6th Instrument: Illuminated Engine & Systems MFD
    roundRectPath(ctx, 736, 558, 250, 136, 10);
    ctx.fillStyle = '#081018';
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = `700 10.5px ${FONT_MONO}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.hudCyan;
    ctx.fillText('ENG / SYS MFD', 750, 578);

    const bars = [
      ['THROT', ac.throttle, ac.boosting ? PALETTE.hudAmber : PALETTE.hudCyan],
      ['FUEL ', ac.fuel / 100, ac.fuel < 22 ? PALETTE.hudRed : PALETTE.hudGreen],
      ['HULL ', ac.hull / 100, ac.hull < 35 ? PALETTE.hudRed : PALETTE.hudCyan],
    ];
    bars.forEach(([lbl, val, col], idx) => {
      const by = 592 + idx * 22;
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(`${lbl} ${Math.round(val * 100)}%`, 750, by + 10);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(840, by, 130, 10);
      ctx.fillStyle = col;
      ctx.fillRect(840, by, 130 * clamp(val, 0, 1), 10);
    });

    const lamps = [
      ['GEAR', ac.gearDown ? PALETTE.hudGreen : '#475569'],
      ['FLAP', ac.flaps ? PALETTE.hudAmber : '#475569'],
      ['BRK', ac.airbrake ? PALETTE.hudAmber : '#475569'],
      ['STALL', ac.stalling ? PALETTE.hudRed : '#334155'],
    ];
    lamps.forEach(([txt, col], idx) => {
      const lx = 750 + idx * 57;
      roundRectPath(ctx, lx, 660, 51, 22, 4);
      ctx.fillStyle = col === '#475569' || col === '#334155' ? '#131d29' : col;
      ctx.fill();
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = col === '#475569' || col === '#334155' ? '#64748b' : '#081018';
      ctx.font = `700 10px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.fillText(txt, lx + 25.5, 675);
    });
    ctx.restore();
  }

  function drawBottomSystemsAndNav(ac, ms, world, cam) {
    const h = VIEWPORT.height;
    const w = VIEWPORT.width;

    if (cam.mode === 'cockpit') {
      drawCockpitPanel(ac, ms, world);
    } else {
      ctx.save();
      roundRectPath(ctx, 24, h - 134, 268, 110, 10);
      ctx.fillStyle = 'rgba(9, 17, 29, 0.78)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(94, 234, 212, 0.36)';
      ctx.lineWidth = 1.3;
      ctx.stroke();

      const rows = [
        ['FUEL', ac.fuel / 100, ac.fuel < 22 ? PALETTE.hudRed : PALETTE.hudGreen],
        ['HULL', ac.hull / 100, ac.hull < 35 ? PALETTE.hudRed : PALETTE.hudCyan],
        ['THROT', ac.throttle, ac.boosting ? PALETTE.hudAmber : '#60a5fa'],
      ];
      ctx.font = `700 11px ${FONT_MONO}`;
      ctx.textAlign = 'left';
      rows.forEach(([lbl, val, col], idx) => {
        const ry = h - 114 + idx * 23;
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText(lbl, 38, ry + 9);
        ctx.fillStyle = 'rgba(148, 163, 184, 0.2)';
        ctx.fillRect(88, ry, 106, 10);
        ctx.fillStyle = col;
        ctx.fillRect(88, ry, 106 * clamp(val, 0, 1), 10);
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(`${Math.round(val * 100)}%`, 200, ry + 9);
      });

      const wx = 262;
      const wy = h - 88;
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(wx, wy, 18, 0, Math.PI * 2);
      ctx.stroke();
      const windRel = Math.atan2(ac.windVec.x, ac.windVec.z) - ac.yaw - Math.PI * 0.5;
      ctx.strokeStyle = PALETTE.hudCyan;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.lineTo(wx + Math.cos(windRel) * 14, wy + Math.sin(windRel) * 14);
      ctx.stroke();
      ctx.fillStyle = '#94a3b8';
      ctx.font = `700 9px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.fillText(`WND ${Math.round(Math.hypot(ac.windVec.x, ac.windVec.z) * 1.94)}K`, wx, wy + 30);

      const chips = [
        ['GEAR', ac.gearDown, PALETTE.hudGreen],
        ['FLAPS', ac.flaps, PALETTE.hudAmber],
        ['BOOST', ac.boosting, PALETTE.hudAmber],
        ['BRAKE', ac.airbrake, PALETTE.hudRed],
      ];
      chips.forEach(([name, active, col], i) => {
        const cx = 38 + i * 56;
        const cy = h - 46;
        roundRectPath(ctx, cx, cy, 50, 16, 4);
        ctx.fillStyle = active ? col : 'rgba(30, 41, 59, 0.78)';
        ctx.fill();
        ctx.fillStyle = active ? '#081018' : '#64748b';
        ctx.font = `700 9px ${FONT_MONO}`;
        ctx.textAlign = 'center';
        ctx.fillText(name, cx + 25, cy + 11);
      });
      ctx.restore();
    }

    // Bottom-Right: Sortie Nav Card (neatly sits beside ENG/SYS MFD in Cockpit mode too!)
    const target = getActiveTarget(ms, world.runways);
    const distM = Math.round(Math.hypot(target.x - ac.pos.x, target.y - ac.pos.y, target.z - ac.pos.z));
    const cardW = 256;
    const cardX = w - cardW - 22;
    const cardY = cam.mode === 'cockpit' ? 558 : h - 134;
    const cardH = cam.mode === 'cockpit' ? 136 : 110;

    ctx.save();
    roundRectPath(ctx, cardX, cardY, cardW, cardH, 10);
    ctx.fillStyle = 'rgba(9, 17, 29, 0.84)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.hudAmber;
    ctx.font = `700 10px ${FONT_MONO}`;
    ctx.fillText(ms.mission.title.toUpperCase(), cardX + 14, cardY + 22);

    ctx.fillStyle = '#f8fafc';
    ctx.font = `700 13px ${FONT_SANS}`;
    ctx.fillText(target.label, cardX + 14, cardY + 42);

    ctx.fillStyle = PALETTE.hudCyan;
    ctx.font = `700 12px ${FONT_MONO}`;
    const distStr = distM >= 1000 ? `${(distM / 1000).toFixed(2)} KM` : `${distM} M`;
    ctx.fillText(`RANGE  ${distStr}`, cardX + 14, cardY + 66);

    const gatesTotal = ms.gates.length;
    const gateLabel = gatesTotal > 0 ? `RINGS ${ms.gatesCleared}/${gatesTotal}` : 'FREE PATROL';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(`${gateLabel}   SCORE ${ms.score}`, cardX + 14, cardY + 88);

    const mm = String(Math.floor(ms.elapsed / 60)).padStart(2, '0');
    const ss = String(Math.floor(ms.elapsed % 60)).padStart(2, '0');
    ctx.fillStyle = '#94a3b8';
    ctx.font = `600 10.5px ${FONT_MONO}`;
    ctx.fillText(`TIME ${mm}:${ss}   CAM ${cam.mode.toUpperCase()}`, cardX + 14, cardY + (cam.mode === 'cockpit' ? 114 : 103));
    ctx.restore();
  }

  function drawTargetAndBanners(ac, ms, world, proj) {
    const target = getActiveTarget(ms, world.runways);
    const sp = proj.worldPointToScreen(target);
    const w = VIEWPORT.width;
    const h = VIEWPORT.height;
    const distM = Math.round(Math.hypot(target.x - ac.pos.x, target.y - ac.pos.y, target.z - ac.pos.z));

    ctx.save();
    if (sp && sp.x > 40 && sp.x < w - 40 && sp.y > 40 && sp.y < h - 180) {
      ctx.strokeStyle = PALETTE.hudAmber;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y - 16);
      ctx.lineTo(sp.x + 14, sp.y);
      ctx.lineTo(sp.x, sp.y + 16);
      ctx.lineTo(sp.x - 14, sp.y);
      ctx.closePath();
      ctx.stroke();

      ctx.fillStyle = PALETTE.hudAmber;
      ctx.font = `700 11px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.fillText(`${distM}M`, sp.x, sp.y - 22);
    }

    let alertText = '';
    let alertColor = PALETTE.hudCyan;
    if (ac.stalling) {
      alertText = 'STALL WARNING // NOSE DOWN & THROTTLE UP';
      alertColor = PALETTE.hudRed;
    } else if (ac.agl < 32 && !ac.onGround && ac.verticalSpeed < -7) {
      alertText = 'PULL UP // SINK RATE';
      alertColor = PALETTE.hudRed;
    } else if (ac.touchdownBannerTimer > 0) {
      alertText = `${ac.touchdownQuality} // REFUELING & REPAIR`;
      alertColor = PALETTE.hudGreen;
    } else if (ms.runwayPhase === 'landing' && distM < 800 && !ac.gearDown) {
      alertText = 'FINAL APPROACH // PRESS [G] TO LOWER GEAR';
      alertColor = PALETTE.hudAmber;
    } else if (ms.bannerTimer > 0 && ms.bannerText) {
      alertText = ms.bannerText;
      alertColor = PALETTE.hudCyan;
    }

    if (alertText) {
      roundRectPath(ctx, w * 0.5 - 235, 82, 470, 28, 6);
      ctx.fillStyle = 'rgba(9, 17, 29, 0.84)';
      ctx.fill();
      ctx.strokeStyle = alertColor;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = alertColor;
      ctx.font = `700 12px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.fillText(alertText, w * 0.5, 100);
    }
    ctx.restore();
  }

  return {
    drawHud(ac, ms, world, cam, proj, simTime, showFullHud = true) {
      ctx.clearRect(0, 0, VIEWPORT.width, VIEWPORT.height);
      if (!showFullHud) return;

      const storm = ms.mission.storm ?? 0;
      if (cam.mode === 'cockpit') drawCockpitFrameAndCombiner(ac, storm, simTime);
      else drawStormRain(storm, simTime);

      const target = getActiveTarget(ms, world.runways);
      const targetBearingRad = Math.atan2(target.x - ac.pos.x, target.z - ac.pos.z);

      drawPitchLadder(ac, targetBearingRad, cam.mode === 'cockpit');
      drawTopCompass(ac, targetBearingRad);
      drawSideTapes(ac);
      drawBottomSystemsAndNav(ac, ms, world, cam);
      drawTacticalMinimap(ctx, ac, ms, world, cam.mode, simTime);
      drawTargetAndBanners(ac, ms, world, proj);
    },
  };
}
