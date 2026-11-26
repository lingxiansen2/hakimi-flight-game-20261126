// Mission progression, checkpoint ring detection, carrier/runway touchdown grading, and scoring.

export function createMissionState(mission) {
  return {
    mission,
    gates: mission.gates.map((g, idx) => ({ ...g, index: idx, cleared: false })),
    currentGateIndex: 0,
    elapsed: 0,
    score: 0,
    gatesCleared: 0,
    runwayPhase: mission.gates.length === 0 ? 'free' : 'gates',
    completed: false,
    grade: '',
    touchdownGrade: '',
    bannerText: mission.gates.length > 0 ? mission.gates[0].label : 'FREE-FLIGHT PATROL',
    bannerTimer: 3.5,
  };
}

export function stepMissionState(ms, ac, dt) {
  const result = {
    gateCleared: false,
    missionComplete: false,
  };

  ms.elapsed += dt;
  ms.bannerTimer = Math.max(0, ms.bannerTimer - dt);

  if (ms.completed || ms.mission.id === 'free-flight') {
    if (ac.onRunway && ac.onGround && ac.airspeed > 4) {
      ms.score += Math.round(dt * 12);
    }
    return result;
  }

  if (ms.runwayPhase === 'gates') {
    const gate = ms.gates[ms.currentGateIndex];
    if (gate) {
      const dist = Math.hypot(ac.pos.x - gate.x, ac.pos.y - gate.y, ac.pos.z - gate.z);
      if (dist <= gate.radius + 7) {
        gate.cleared = true;
        ms.gatesCleared += 1;
        ms.score += 250 + Math.round(ac.airspeed * 2.5);
        ms.currentGateIndex += 1;
        result.gateCleared = true;

        if (ms.currentGateIndex >= ms.gates.length) {
          ms.runwayPhase = 'landing';
          ms.bannerText = ms.mission.targetRunwayId === 'carrier'
            ? 'ALL GATES CLEARED // LAND ON CVN-07 CARRIER'
            : 'ALL GATES CLEARED // LAND AT TARGET STRIP';
          ms.bannerTimer = 4.5;
        } else {
          ms.bannerText = ms.gates[ms.currentGateIndex].label;
          ms.bannerTimer = 3.0;
        }
      }
    }
  } else if (ms.runwayPhase === 'landing') {
    if (ac.onGround && ac.onRunway && ac.onRunway.id === ms.mission.targetRunwayId && ac.airspeed < 22) {
      ms.runwayPhase = 'complete';
      ms.completed = true;
      ms.touchdownGrade = ac.lastTouchdownGrade || 'FIRM';
      const timeBonus = Math.max(0, Math.round((ms.mission.parTime - ms.elapsed) * 18));
      const hullBonus = Math.round(ac.hull * 6);
      const fuelBonus = Math.round(ac.fuel * 3);
      const touchBonus = ms.touchdownGrade === 'BUTTER' ? 350 : ms.touchdownGrade === 'FIRM' ? 180 : 60;
      ms.score += 600 + timeBonus + hullBonus + fuelBonus + touchBonus;
      ms.grade = ms.score >= 3000 ? 'ACE' : ms.score >= 2300 ? 'GOLD' : ms.score >= 1650 ? 'SILVER' : 'CLEARED';
      ms.bannerText = `SORTIE COMPLETE // ${ms.touchdownGrade} LANDING`;
      ms.bannerTimer = 5.0;
      result.missionComplete = true;
    }
  }

  return result;
}

export function getActiveTarget(ms, runways) {
  if (ms.runwayPhase === 'gates' && ms.gates[ms.currentGateIndex]) {
    const g = ms.gates[ms.currentGateIndex];
    return { kind: 'gate', x: g.x, y: g.y, z: g.z, label: g.label };
  }
  if (ms.runwayPhase === 'landing' && ms.mission.targetRunwayId) {
    const r = runways.find((rw) => rw.id === ms.mission.targetRunwayId);
    if (r) return { kind: 'runway', x: r.x, y: r.y + 8, z: r.z, label: r.name };
  }
  return { kind: 'runway', x: runways[0].x, y: runways[0].y + 8, z: runways[0].z, label: runways[0].name };
}
