// Aviation HUD and lit glass-cockpit instrument panel renderer.

import { PALETTE, VIEWPORT } from './config.js';
import { clamp, wrapAngle } from './math3d.js';
import { getActiveTarget } from './missions.js';

const FONT_MONO = '"Cascadia Mono", "Consolas", ui-monospace, monospace';
const FONT_SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Draw a lit circular analog-digital cockpit dial at (cx, cy). */
function drawDial(ctx, cx, cy, radius, title, valueText, needleAngle, accentColor, subText = '') {
  ctx.save();
  // Recessed bezel
  ctx.fillStyle = '#0f1620';
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3b4d63';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Dial face
  const faceGrad = ctx.createRadialGradient(cx, cy, 4, cx, cy, radius);
  faceGrad.addColorStop(0, '#162231');
  faceGrad.addColorStop(1, '#090e16');
  ctx.fillStyle = faceGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  // Tick marks
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2 - Math.PI * 0.5;
    const rIn = radius * (i % 3 === 0 ? 0.72 : 0.8);
    ctx.strokeStyle = i % 3 === 0 ? '#94a3b8' : '#475569';
    ctx.lineWidth = i % 3 === 0 ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * rIn, cy + Math.sin(a) * rIn);
    ctx.lineTo(cx + Math.cos(a) * (radius - 4), cy + Math.sin(a) * (radius - 4));
    ctx.stroke();
  }

  // Title & digital readout
  ctx.fillStyle = '#94a3b8';
  ctx.font = `700 10px ${FONT_MONO}`;
  ctx.textAlign = 'center';
  ctx.fillText(title, cx, cy - radius * 0.42);

  ctx.fillStyle = accentColor;
  ctx.font = `700 15px ${FONT_MONO}`;
  ctx.fillText(valueText, cx, cy + radius * 0.46);

  if (subText) {
    ctx.fillStyle = '#cbd5e1';
    ctx.font = `600 10px ${FONT_MONO}`;
    ctx.fillText(subText, cx, cy + radius * 0.68);
  }

  // Glowing needle
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(needleAngle) * (radius * 0.78), cy + Math.sin(needleAngle) * (radius * 0.78));
  ctx.stroke();

  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Draw artificial horizon attitude ball inside a circular bezel. */
function drawAttitudeBall(ctx, cx, cy, radius, pitch, roll) {
  ctx.save();
  ctx.fillStyle = '#0f1620';
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3b4d63';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-roll);
  const pOff = clamp(pitch * 58, -radius * 0.85, radius * 0.85);
  ctx.fillStyle = '#1e6aa8';
  ctx.fillRect(-radius * 1.5, -radius * 2 + pOff, radius * 3, radius * 2);
  ctx.fillStyle = '#7c4c29';
  ctx.fillRect(-radius * 1.5, pOff, radius * 3, radius * 2);

  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-radius, pOff);
  ctx.lineTo(radius, pOff);
  ctx.stroke();

  for (const deg of [-20, -10, 10, 20]) {
    const py = pOff - (deg * Math.PI / 180) * 58;
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.75)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-18, py);
    ctx.lineTo(18, py);
    ctx.stroke();
  }
  ctx.restore();

  // Fixed yellow aircraft reference datum
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

export function createHudRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function drawPitchLadder(ac, targetBearingRad) {
    const cx = VIEWPORT.width * 0.5;
    const cy = VIEWPORT.height * 0.5;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-ac.roll);

    const pxPerRad = 320;
    const pitchOffset = ac.pitch * pxPerRad;

    ctx.strokeStyle = 'rgba(94, 234, 212, 0.65)';
    ctx.fillStyle = 'rgba(94, 234, 212, 0.85)';
    ctx.font = `600 11px ${FONT_MONO}`;

    for (let deg = -20; deg <= 20; deg += 10) {
      if (deg === 0) {
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-90, pitchOffset);
        ctx.lineTo(-26, pitchOffset);
        ctx.moveTo(26, pitchOffset);
        ctx.lineTo(90, pitchOffset);
        ctx.stroke();
        continue;
      }
      const y = pitchOffset - ((deg * Math.PI) / 180) * pxPerRad;
      if (Math.abs(y) > 155) continue;
      ctx.lineWidth = 1.4;
      if (deg < 0) ctx.setLineDash([6, 4]);
      else ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(-58, y);
      ctx.lineTo(-20, y);
      ctx.moveTo(20, y);
      ctx.lineTo(58, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.textAlign = 'right';
      ctx.fillText(String(deg), -63, y + 4);
      ctx.textAlign = 'left';
      ctx.fillText(String(deg), 63, y + 4);
    }

    ctx.restore();

    // Fixed boresight reticle & bank pointer
    ctx.save();
    ctx.strokeStyle = PALETTE.hudCyan;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 18, cy);
    ctx.lineTo(cx - 6, cy);
    ctx.lineTo(cx, cy + 5);
    ctx.lineTo(cx + 6, cy);
    ctx.lineTo(cx + 18, cy);
    ctx.stroke();

    // Relative heading bug indicator on horizon ring
    const relHeading = wrapAngle(targetBearingRad - ac.yaw);
    const bugX = clamp(cx + Math.sin(relHeading) * 140, cx - 180, cx + 180);
    ctx.fillStyle = PALETTE.hudAmber;
    ctx.beginPath();
    ctx.moveTo(bugX, cy - 118);
    ctx.lineTo(bugX - 6, cy - 129);
    ctx.lineTo(bugX + 6, cy - 129);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawTopCompass(ac, targetBearingRad) {
    const cx = VIEWPORT.width * 0.5;
    const width = 340;
    const x0 = cx - width * 0.5;
    const y0 = 16;

    ctx.save();
    roundRectPath(ctx, x0, y0, width, 42, 8);
    ctx.fillStyle = 'rgba(10, 18, 30, 0.72)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(94, 234, 212, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    const hdgDeg = ((ac.yaw * 180) / Math.PI + 360) % 360;
    const targetDeg = ((targetBearingRad * 180) / Math.PI + 360) % 360;

    ctx.beginPath();
    ctx.rect(x0 + 8, y0, width - 16, 42);
    ctx.clip();

    const pxPerDeg = 3.2;
    const labels = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
    ctx.font = `700 11px ${FONT_MONO}`;
    ctx.textAlign = 'center';

    for (let d = -60; d <= 60; d += 5) {
      const tickDeg = Math.round(hdgDeg / 5) * 5 + d;
      const normDeg = ((tickDeg % 360) + 360) % 360;
      const dx = (tickDeg - hdgDeg) * pxPerDeg;
      const sx = cx + dx;
      const isMajor = normDeg % 15 === 0;
      ctx.strokeStyle = isMajor ? 'rgba(226, 232, 240, 0.85)' : 'rgba(148, 163, 184, 0.45)';
      ctx.lineWidth = isMajor ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(sx, y0 + 28);
      ctx.lineTo(sx, y0 + (isMajor ? 39 : 35));
      ctx.stroke();
      if (normDeg % 15 === 0) {
        ctx.fillStyle = labels[normDeg] ? PALETTE.hudCyan : '#cbd5e1';
        ctx.fillText(labels[normDeg] ?? String(normDeg).padStart(3, '0'), sx, y0 + 22);
      }
    }

    // Target bearing diamond on compass tape
    let diff = ((targetDeg - hdgDeg + 540) % 360) - 180;
    const tx = clamp(cx + diff * pxPerDeg, x0 + 16, x0 + width - 16);
    ctx.fillStyle = PALETTE.hudAmber;
    ctx.beginPath();
    ctx.moveTo(tx, y0 + 30);
    ctx.lineTo(tx - 5, y0 + 36);
    ctx.lineTo(tx + 5, y0 + 36);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Digital heading box
    ctx.save();
    roundRectPath(ctx, cx - 28, y0 + 44, 56, 20, 4);
    ctx.fillStyle = 'rgba(12, 22, 36, 0.9)';
    ctx.fill();
    ctx.strokeStyle = PALETTE.hudCyan;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = PALETTE.hudInk;
    ctx.font = `700 12px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText(`${String(Math.round(hdgDeg) % 360).padStart(3, '0')}°`, cx, y0 + 58);
    ctx.restore();
  }

  function drawSpeedAndAltitudeTapes(ac) {
    const cy = VIEWPORT.height * 0.5;
    const kts = Math.round(ac.airspeed * 1.94384);
    const altFt = Math.round(ac.pos.y * 3.28084);
    const aglFt = Math.round(ac.agl * 3.28084);
    const vsiFpm = Math.round(ac.verticalSpeed * 196.85);

    // Left: Airspeed card
    ctx.save();
    roundRectPath(ctx, 24, cy - 86, 122, 172, 10);
    ctx.fillStyle = 'rgba(10, 18, 30, 0.74)';
    ctx.fill();
    ctx.strokeStyle = ac.stalling ? PALETTE.hudRed : 'rgba(94, 234, 212, 0.35)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = `700 10px ${FONT_MONO}`;
    ctx.textAlign = 'left';
    ctx.fillText('AIRSPEED', 36, cy - 64);

    ctx.fillStyle = ac.stalling ? PALETTE.hudRed : PALETTE.hudInk;
    ctx.font = `700 32px ${FONT_MONO}`;
    ctx.fillText(String(kts), 36, cy - 26);

    ctx.fillStyle = PALETTE.hudCyan;
    ctx.font = `700 11px ${FONT_MONO}`;
    ctx.fillText('KTS', 102, cy - 26);

    // Speed bar
    const spdRatio = clamp(ac.airspeed / 120, 0, 1);
    ctx.fillStyle = 'rgba(148, 163, 184, 0.22)';
    ctx.fillRect(36, cy - 6, 98, 8);
    ctx.fillStyle = ac.stalling ? PALETTE.hudRed : ac.boosting ? PALETTE.hudAmber : PALETTE.hudCyan;
    ctx.fillRect(36, cy - 6, 98 * spdRatio, 8);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = `600 11px ${FONT_MONO}`;
    ctx.fillText(`G-LOAD  ${ac.gLoad.toFixed(1)}G`, 36, cy + 26);
    ctx.fillText(`THROT  ${Math.round(ac.throttle * 100)}%`, 36, cy + 46);
    ctx.fillText(`AOA   ${Math.round((ac.aoa * 180) / Math.PI)}°`, 36, cy + 66);
    ctx.restore();

    // Right: Altitude & VSI card
    const rx = VIEWPORT.width - 154;
    ctx.save();
    roundRectPath(ctx, rx, cy - 86, 130, 172, 10);
    ctx.fillStyle = 'rgba(10, 18, 30, 0.74)';
    ctx.fill();
    ctx.strokeStyle = ac.agl < 25 && !ac.onGround ? PALETTE.hudAmber : 'rgba(94, 234, 212, 0.35)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = `700 10px ${FONT_MONO}`;
    ctx.textAlign = 'left';
    ctx.fillText('ALTITUDE MSL', rx + 12, cy - 64);

    ctx.fillStyle = PALETTE.hudInk;
    ctx.font = `700 29px ${FONT_MONO}`;
    ctx.fillText(String(altFt), rx + 12, cy - 28);

    ctx.fillStyle = PALETTE.hudCyan;
    ctx.font = `700 11px ${FONT_MONO}`;
    ctx.fillText('FT', rx + 102, cy - 28);

    ctx.fillStyle = ac.agl < 80 ? PALETTE.hudAmber : '#cbd5e1';
    ctx.font = `600 11px ${FONT_MONO}`;
    ctx.fillText(`RADAR  ${aglFt} FT`, rx + 12, cy + 12);

    const vsiSign = vsiFpm >= 0 ? '+' : '';
    ctx.fillStyle = vsiFpm < -900 ? PALETTE.hudAmber : '#cbd5e1';
    ctx.fillText(`VSI ${vsiSign}${vsiFpm}`, rx + 12, cy + 34);

    // Mini vertical speed bar
    const vsiNorm = clamp(vsiFpm / 2000, -1, 1);
    ctx.fillStyle = 'rgba(148, 163, 184, 0.22)';
    ctx.fillRect(rx + 12, cy + 50, 106, 8);
    ctx.fillStyle = vsiNorm >= 0 ? PALETTE.hudGreen : PALETTE.hudAmber;
    if (vsiNorm >= 0) ctx.fillRect(rx + 65, cy + 50, 53 * vsiNorm, 8);
    else ctx.fillRect(rx + 65 + 53 * vsiNorm, cy + 50, -53 * vsiNorm, 8);
    ctx.restore();
  }

  function drawSystemsAndNav(ac, ms, world, cam) {
    const h = VIEWPORT.height;
    const w = VIEWPORT.width;
    const isCockpit = cam.mode === 'cockpit';

    // In cockpit mode, render full illuminated instrument deck along the bottom!
    if (isCockpit) {
      ctx.save();
      const panelY = 532;
      const deckGrad = ctx.createLinearGradient(0, panelY, 0, h);
      deckGrad.addColorStop(0, '#1e2835');
      deckGrad.addColorStop(0.08, '#131b26');
      deckGrad.addColorStop(1, '#090d14');
      ctx.fillStyle = deckGrad;
      ctx.beginPath();
      ctx.moveTo(0, panelY + 26);
      ctx.quadraticCurveTo(w * 0.5, panelY - 14, w, panelY + 26);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#3b4d63';
      ctx.lineWidth = 3;
      ctx.stroke();

      const kts = Math.round(ac.airspeed * 1.94384);
      const altFt = Math.round(ac.pos.y * 3.28084);
      const hdgDeg = Math.round(((ac.yaw * 180) / Math.PI + 360) % 360) % 360;
      const target = getActiveTarget(ms, world.runways);
      const bearing = Math.atan2(target.x - ac.pos.x, target.z - ac.pos.z);
      const relBearing = wrapAngle(bearing - ac.yaw);

      drawDial(ctx, 130, 628, 62, 'AIRSPEED', `${kts}`, -Math.PI * 0.8 + clamp(kts / 240, 0, 1) * Math.PI * 1.6, PALETTE.hudCyan, 'KTS');
      drawAttitudeBall(ctx, 286, 625, 68, ac.pitch, ac.roll);
      drawDial(ctx, 442, 628, 62, 'ALTIMETER', `${altFt}`, -Math.PI * 0.5 + (altFt / 1000) * Math.PI * 2, PALETTE.hudGreen, `AGL ${Math.round(ac.agl * 3.28)}FT`);
      drawDial(ctx, 598, 628, 62, 'NAV HSI', `${String(hdgDeg).padStart(3, '0')}°`, -Math.PI * 0.5 + relBearing, PALETTE.hudAmber, 'WAYPOINT');

      // Right-hand Systems & Engine MFD inside cockpit panel (clears bottom-right mission card!)
      roundRectPath(ctx, 690, 562, 276, 132, 10);
      ctx.fillStyle = '#09111a';
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = `700 11px ${FONT_MONO}`;
      ctx.textAlign = 'left';
      ctx.fillStyle = PALETTE.hudCyan;
      ctx.fillText('ENG / SYS MFD', 706, 582);

      const bars = [
        ['THROT', ac.throttle, ac.boosting ? PALETTE.hudAmber : PALETTE.hudCyan],
        ['FUEL ', ac.fuel / 100, ac.fuel < 22 ? PALETTE.hudRed : PALETTE.hudGreen],
        ['HULL ', ac.hull / 100, ac.hull < 35 ? PALETTE.hudRed : PALETTE.hudCyan],
      ];
      bars.forEach(([label, frac, col], idx) => {
        const by = 596 + idx * 22;
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText(`${label} ${Math.round(frac * 100)}%`, 706, by + 10);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(800, by, 146, 10);
        ctx.fillStyle = col;
        ctx.fillRect(800, by, 146 * clamp(frac, 0, 1), 10);
      });

      // Lit Gear / Flaps / Brake / Stall annunciator lamps
      const lamps = [
        ['GEAR', ac.gearDown ? PALETTE.hudGreen : '#475569'],
        ['FLAP', ac.flaps ? PALETTE.hudAmber : '#475569'],
        ['BRK', ac.airbrake ? PALETTE.hudAmber : '#475569'],
        ['STALL', ac.stalling ? PALETTE.hudRed : '#334155'],
      ];
      lamps.forEach(([txt, col], idx) => {
        const lx = 706 + idx * 63;
        roundRectPath(ctx, lx, 662, 56, 22, 4);
        ctx.fillStyle = col === '#475569' || col === '#334155' ? '#131d29' : col;
        ctx.fill();
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.fillStyle = col === '#475569' || col === '#334155' ? '#64748b' : '#081018';
        ctx.font = `700 10px ${FONT_MONO}`;
        ctx.textAlign = 'center';
        ctx.fillText(txt, lx + 28, 677);
      });
      ctx.restore();
    } else {
      // Bottom-left compact systems + wind vane card (Chase / Orbit views)
      ctx.save();
      roundRectPath(ctx, 24, h - 134, 268, 110, 10);
      ctx.fillStyle = 'rgba(10, 18, 30, 0.76)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(94, 234, 212, 0.35)';
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

      // Wind vane dial
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

      // Status chips
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
        ctx.fillStyle = active ? col : 'rgba(30, 41, 59, 0.75)';
        ctx.fill();
        ctx.fillStyle = active ? '#09111a' : '#64748b';
        ctx.font = `700 9px ${FONT_MONO}`;
        ctx.textAlign = 'center';
        ctx.fillText(name, cx + 25, cy + 11);
      });
      ctx.restore();
    }

    // Bottom-Right: Mission Waypoint & Sortie Card
    const target = getActiveTarget(ms, world.runways);
    const distM = Math.round(Math.hypot(target.x - ac.pos.x, target.y - ac.pos.y, target.z - ac.pos.z));
    ctx.save();
    roundRectPath(ctx, w - 284, h - 134, 260, 110, 10);
    ctx.fillStyle = 'rgba(10, 18, 30, 0.78)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.42)';
    ctx.lineWidth = 1.3;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.hudAmber;
    ctx.font = `700 10px ${FONT_MONO}`;
    ctx.fillText(ms.mission.title.toUpperCase(), w - 270, h - 112);

    ctx.fillStyle = '#f8fafc';
    ctx.font = `700 13px ${FONT_SANS}`;
    ctx.fillText(target.label, w - 270, h - 92);

    ctx.fillStyle = PALETTE.hudCyan;
    ctx.font = `700 12px ${FONT_MONO}`;
    const distStr = distM >= 1000 ? `${(distM / 1000).toFixed(2)} KM` : `${distM} M`;
    ctx.fillText(`RANGE  ${distStr}`, w - 270, h - 68);

    const gatesTotal = ms.gates.length;
    const gateLabel = gatesTotal > 0 ? `RINGS ${ms.gatesCleared}/${gatesTotal}` : 'FREE PATROL';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(`${gateLabel}   SCORE ${ms.score}`, w - 270, h - 46);

    const mm = String(Math.floor(ms.elapsed / 60)).padStart(2, '0');
    const ss = String(Math.floor(ms.elapsed % 60)).padStart(2, '0');
    ctx.fillStyle = '#94a3b8';
    ctx.font = `600 11px ${FONT_MONO}`;
    ctx.fillText(`TIME ${mm}:${ss}   CAM ${cam.mode.toUpperCase()}`, w - 270, h - 28);
    ctx.restore();
  }

  function drawTargetMarkerAndAlerts(ac, ms, world, proj) {
    const target = getActiveTarget(ms, world.runways);
    const sp = proj.worldPointToScreen(target);
    const w = VIEWPORT.width;
    const h = VIEWPORT.height;
    const distM = Math.round(Math.hypot(target.x - ac.pos.x, target.y - ac.pos.y, target.z - ac.pos.z));

    ctx.save();
    if (sp && sp.x > 40 && sp.x < w - 40 && sp.y > 40 && sp.y < h - 140) {
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

    // Center-top alert / banner
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
    } else if (ms.runwayPhase === 'landing' && distM < 750 && !ac.gearDown) {
      alertText = 'FINAL APPROACH // PRESS [G] TO LOWER GEAR';
      alertColor = PALETTE.hudAmber;
    } else if (ms.bannerTimer > 0 && ms.bannerText) {
      alertText = ms.bannerText;
      alertColor = PALETTE.hudCyan;
    }

    if (alertText) {
      roundRectPath(ctx, w * 0.5 - 230, 86, 460, 28, 6);
      ctx.fillStyle = 'rgba(10, 18, 30, 0.82)';
      ctx.fill();
      ctx.strokeStyle = alertColor;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = alertColor;
      ctx.font = `700 12px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.fillText(alertText, w * 0.5, 104);
    }
    ctx.restore();
  }

  return {
    drawHud(ac, ms, world, cam, proj, showFullHud = true) {
      if (!showFullHud) return;
      const target = getActiveTarget(ms, world.runways);
      const targetBearingRad = Math.atan2(target.x - ac.pos.x, target.z - ac.pos.z);

      drawPitchLadder(ac, targetBearingRad);
      drawTopCompass(ac, targetBearingRad);
      drawSpeedAndAltitudeTapes(ac);
      drawSystemsAndNav(ac, ms, world, cam);
      drawTargetMarkerAndAlerts(ac, ms, world, proj);
    },
  };
}
