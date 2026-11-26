# Solara Corsair

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Rank](https://make.fun/badge/best-flight-game-20261126-0057/lingxiansen2/hakimi-flight-game-20261126/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Reward](https://make.fun/badge/best-flight-game-20261126-0057/lingxiansen2/hakimi-flight-game-20261126/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

An original offline 3D desktop flight game built for the [make.fun Best Flight Game](https://make.fun/bounty/best-flight-game-20261126-0057) bounty.

Pilot the **Solara Corsair**, a twin-boom coastal bush seaplane, across sunlit volcanic islands, basalt sea-stacks, lighthouse ridges, and island STOL airstrips.

## Highlights

- **100% Offline Static Bundle**: Pure ES modules and Canvas2D 3D rendering under `game/` with zero external network requests, zero build step, and zero `eval` / `new Function`.
- **6-DOF Aerodynamic Flight Model**: Angle-of-attack lift & stall recovery, induced/parasite drag, coordinated bank-to-turn, flaps (`F`), retractable landing gear (`G`), airbrake (`B`), overdrive boost (`Shift`), wind gusts, fuel management, and runway touch-and-go repair/refuel.
- **Multiple Camera Views (`V`)**: Dynamic spring-damped Chase Camera, Lit Glass-Cockpit Canopy View with working dials, and Scenic Flyover.
- **3 Missions + Free Flight**: *Archipelago Mail Run*, *Stormwatch Beacon Drop*, *Sunburst Canyon Trial*, and *Free Flight*.
- **Procedural Web Audio (`M`)**: Engine RPM harmonics, airspeed wind rush, stall warning horn, checkpoint chimes, gear actuators, and touchdown tire chirp.

## Run Locally

```bash
node serve.ts
```

Then open `http://localhost:8080` in desktop Chrome.

## Build Dossier

```bash
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```
