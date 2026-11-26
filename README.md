# Solara Corsair

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Rank](https://make.fun/badge/best-flight-game-20261126-0057/lingxiansen2/hakimi-flight-game-20261126/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Reward](https://make.fun/badge/best-flight-game-20261126-0057/lingxiansen2/hakimi-flight-game-20261126/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

An original offline WebGL2 PBR 3D desktop flight game built for the [make.fun Best Flight Game](https://make.fun/bounty/best-flight-game-20261126-0057) bounty.

Pilot the **SC-7 Solara Corsair**, a sculpted twin-boom bush seaplane, across sunlit volcanic islands, Solara Harbor Town, an archipelago suspension bridge, stormfront seas, and the offshore aircraft carrier **CVN-07 Solara**.

## Highlights

- **100% Offline WebGL2 PBR Static Bundle**: Custom ES modules, modular GLSL shaders (`sky`, `ocean`, `terrain`, `mesh`), and offline procedural CanvasTextures under `game/` with zero external network requests, zero build step, and zero `eval` / `new Function`.
- **6-DOF Aerodynamic Flight Model**: Angle-of-attack lift & stall recovery, volcanic thermal updrafts, induced/parasite drag, coordinated bank-to-turn, flaps (`F`), retractable landing gear (`G`), airbrake (`B`), overdrive boost (`Shift`), wind gusts, fuel & hull integrity, and carrier/runway touch-and-go repair/refuel with touchdown grading (`BUTTER / FIRM / HARD / CRASH`).
- **Beveled 6-Dial Cockpit & Tactical Radar (`V`)**: Dynamic Chase Camera, Riveted 6-Dial + MFD + Collimated HUD Combiner Cockpit View, Tactical Mini-Radar, and Scenic Orbit.
- **5 Sorties**: *Archipelago Mail Drop*, *Stormfront Carrier Approach* (`CVN-07 Solara`), *Caldera Thermal Rescue*, *Sunset Canyon Slalom*, and *Free-Flight Patrol*.
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
