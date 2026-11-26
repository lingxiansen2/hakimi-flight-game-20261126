// Global configuration, palette, aircraft specs, and mission definitions for Solara Corsair.

export const VIEWPORT = {
  width: 1280,
  height: 720,
  fovDeg: 64,
  nearZ: 2.5,
  farZ: 3600,
};

export const STEP = 1 / 60;
export const STORAGE_KEY = 'solara-corsair.records.v1';

export const AIRCRAFT_SPEC = {
  name: 'SC-7 Solara Corsair',
  maxSpeed: 118,       // m/s (~230 kts)
  cruiseSpeed: 68,     // m/s (~132 kts)
  stallSpeed: 28,      // m/s (~54 kts)
  maxThrust: 26,       // m/s^2 equivalent acceleration
  boostMultiplier: 1.48,
  gravity: 9.81,
  wingAreaFactor: 0.022,
  baseDrag: 0.018,
  inducedDrag: 0.048,
  flapLiftBonus: 0.34,
  flapDragPenalty: 0.014,
  gearDragPenalty: 0.0085,
  brakeDragPenalty: 0.026,
  rollRate: 2.25,
  pitchRate: 1.55,
  yawRate: 0.72,
  fuelBurnBase: 0.24,  // % per second at full throttle
  boostBurnExtra: 0.55,
  maxGLoad: 6.2,
  maxLandingSink: 6.5, // m/s safe touchdown vertical speed
};

export const PALETTE = {
  skyZenith: '#0f2c59',
  skyMid: '#2b6cb0',
  skyHorizon: '#f6c38d',
  sunGlow: '#fff4d2',
  oceanDeep: '#0c3b5e',
  oceanMid: '#136088',
  oceanShallows: '#1f8a9c',
  sand: '#e6cfa3',
  grassLight: '#4e9a51',
  grassDark: '#2f6d43',
  rockLight: '#7d7870',
  rockDark: '#4f4c49',
  volcanoPeak: '#3a3537',
  snowCap: '#d8dee6',
  runwayAsphalt: '#282d35',
  runwayMark: '#f4f1e6',
  hullCream: '#f3efe6',
  hullCrimson: '#d93d32',
  hullSlate: '#263242',
  canopyGlass: '#7fd4f5',
  hudCyan: '#5eead4',
  hudAmber: '#fbbf24',
  hudRed: '#f87171',
  hudGreen: '#4ade80',
  hudInk: '#f8fafc',
};

export const CAMERA_MODES = ['chase', 'cockpit', 'orbit'];

export const MISSIONS = [
  {
    id: 'mail-run',
    title: 'Archipelago Mail Run',
    subtitle: 'Thread Caldera Pass and land at Windward Cliff Strip',
    briefing: 'Navigate the canyon rings over Caldera Ridge, drop past Lighthouse Point, and execute a clean gear-down STOL landing at Windward Strip.',
    startPos: { x: 0, y: 210, z: -620 },
    startYaw: 0.05,
    startSpeed: 64,
    wind: { speed: 7, dirDeg: 245 },
    timeOfDay: 'day',
    parTime: 115,
    gates: [
      { x: 40, y: 185, z: -120, radius: 34, label: 'GATE 1 // SOLARA DEPARTURE' },
      { x: 240, y: 225, z: 480, radius: 34, label: 'GATE 2 // BAY CHANNEL' },
      { x: 640, y: 260, z: 1080, radius: 32, label: 'GATE 3 // CALDERA ENTRY' },
      { x: 960, y: 295, z: 1620, radius: 30, label: 'GATE 4 // CALDERA SADDLE' },
      { x: 1180, y: 230, z: 980, radius: 32, label: 'GATE 5 // EAST DESCENT' },
      { x: 1360, y: 175, z: 160, radius: 34, label: 'GATE 6 // WINDWARD APPROACH' },
    ],
    targetRunwayId: 'windward',
  },
  {
    id: 'beacon-drop',
    title: 'Stormwatch Beacon Run',
    subtitle: 'Crosswind climb to Stormwatch Spire and return to Solara',
    briefing: 'Climb through gusting crosswinds toward northern Stormwatch Spire, skim the lighthouse sea-stacks, and land back at Solara Airfield.',
    startPos: { x: -480, y: 240, z: 450 },
    startYaw: 0.38,
    startSpeed: 68,
    wind: { speed: 12, dirDeg: 295 },
    timeOfDay: 'golden',
    parTime: 135,
    gates: [
      { x: -240, y: 270, z: 1120, radius: 34, label: 'BEACON 1 // NORTH CHANNEL' },
      { x: -120, y: 340, z: 1980, radius: 32, label: 'BEACON 2 // SPIRE ASCENT' },
      { x: 140, y: 410, z: 2620, radius: 30, label: 'BEACON 3 // STORMWATCH CREST' },
      { x: -460, y: 260, z: 2020, radius: 34, label: 'BEACON 4 // SEA-STACK RIDGE' },
      { x: -960, y: 170, z: 1160, radius: 32, label: 'BEACON 5 // LIGHTHOUSE POINT' },
      { x: -260, y: 135, z: 440, radius: 34, label: 'BEACON 6 // SOLARA FINAL' },
    ],
    targetRunwayId: 'solara',
  },
  {
    id: 'canyon-trial',
    title: 'Sunburst Slalom Trial',
    subtitle: 'High-speed canyon & atoll gate sprint with overdrive boost',
    briefing: 'Manage boost fuel and high-G cornering through tight coastal gates from Coral Atoll to Caldera Canyon before landing at Solara.',
    startPos: { x: -1280, y: 195, z: -980 },
    startYaw: 0.72,
    startSpeed: 76,
    wind: { speed: 9, dirDeg: 210 },
    timeOfDay: 'sunset',
    parTime: 105,
    gates: [
      { x: -860, y: 165, z: -560, radius: 30, label: 'SLALOM 1 // ATOLL REEF' },
      { x: -320, y: 140, z: -140, radius: 28, label: 'SLALOM 2 // SOLARA TOWER' },
      { x: 320, y: 210, z: 540, radius: 28, label: 'SLALOM 3 // BASALT ARCH' },
      { x: 880, y: 285, z: 1460, radius: 26, label: 'SLALOM 4 // VOLCANO CANYON' },
      { x: 420, y: 215, z: 960, radius: 28, label: 'SLALOM 5 // RETURN TURN' },
      { x: 30, y: 115, z: 320, radius: 32, label: 'SLALOM 6 // RUNWAY ALIGN' },
    ],
    targetRunwayId: 'solara',
  },
  {
    id: 'free-flight',
    title: 'Free Flight Patrol',
    subtitle: 'Open archipelago exploration, touch-and-go at any airstrip',
    briefing: 'Explore every island, lighthouse, canyon pass, and airstrip at your own pace. Land cleanly on any runway to refuel and repair.',
    startPos: { x: -220, y: 220, z: -520 },
    startYaw: 0.14,
    startSpeed: 64,
    wind: { speed: 6, dirDeg: 240 },
    timeOfDay: 'day',
    parTime: 0,
    gates: [],
    targetRunwayId: null,
  },
];
