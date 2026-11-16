// The entry program (Node 22, standard library only). The frontend itself is
// the static files under app/ — index.html, ES modules and one stylesheet, no
// build step — reading make.fun's public API from the browser. This program
// hands it in: it copies app/ and screenshots/ from beside this file into the
// output directory and writes dossier.json there, using the vendored make.fun
// library (vendor/makefun-frontend.ts, the kit's copy, unchanged — the scorer
// rebuilds the dossier with its own copy and the two must match byte for byte).
//
// Run it outside the grader with MAKEFUN_OUTPUT_DIR standing in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve the app locally with `node serve.ts` (http://localhost:8080).

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse — more than 3
// screenshots, one over 256 KiB, or app/ past 993 files and directories /
// 16 MiB (app/ shares /output's own 1000-entry cap with screenshots/ and
// dossier.json, so it is kept well under).
const DOSSIER_LIMITS = {
  text_max_bytes: 163840,
  screenshots: { max: 3, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 16777216,
};

mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'app'), join(outDir, 'app'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, DOSSIER_LIMITS));
