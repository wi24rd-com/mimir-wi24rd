// Reads and validates mimir.json. Run directly, it prints "owner=" and
// "repositories=" lines for $GITHUB_OUTPUT.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { validateConfig } from '../docs/lib/config.js';

export { BADGES, EXAMPLE_REPO, VISIBILITIES, validateConfig } from '../docs/lib/config.js';

export function loadConfig(path = 'mimir.json') {
  let raw;
  try { raw = readFileSync(path, 'utf8'); } catch { throw new Error(`mimir.json: cannot read ${path}`); }
  let parsed;
  try { parsed = JSON.parse(raw); } catch (e) { throw new Error(`mimir.json: not valid JSON (${e.message})`); }
  return validateConfig(parsed);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const cfg = loadConfig(process.argv[2] ?? 'mimir.json');
    console.log(`owner=${cfg.owner}`);
    console.log(`repositories=${cfg.repos.map((r) => r.split('/')[1]).join(',')}`);
    console.log(`visibility=${cfg.visibility}`);
  } catch (e) { console.error(e.message); process.exit(1); }
}
