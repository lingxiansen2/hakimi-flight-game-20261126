// Entry point for Solara Corsair (make.fun best-flight-game-20261126-0057).
// Copies static offline game/ and screenshots/ into MAKEFUN_OUTPUT_DIR (or /output)
// and generates deterministic dossier.json via the vendored makefun-game library.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const REPO_ROOT = fileURLToPath(new URL('.', import.meta.url));
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const GATE_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

/** Stage game/, screenshots/, and deterministic dossier.json into the output directory. */
function stageEntry(): void {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const destGame = join(OUTPUT_DIR, 'game');
  const destShots = join(OUTPUT_DIR, 'screenshots');
  if (existsSync(destGame)) rmSync(destGame, { recursive: true, force: true });
  if (existsSync(destShots)) rmSync(destShots, { recursive: true, force: true });

  cpSync(join(REPO_ROOT, 'game'), destGame, { recursive: true });
  mkdirSync(destShots, { recursive: true });
  if (existsSync(join(REPO_ROOT, 'screenshots'))) {
    cpSync(join(REPO_ROOT, 'screenshots'), destShots, { recursive: true });
  }

  const dossierBytes = buildDossier(OUTPUT_DIR, GATE_CAPS);
  writeFileSync(join(OUTPUT_DIR, 'dossier.json'), dossierBytes);
}

stageEntry();
