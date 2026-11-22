// Reads and writes the data folder (the checked-out "data" branch).
//   public / private : state.json         + raw/<day>/<owner>__<repo>.json
//   encrypted        : state.enc          + raw/<day>.enc   (repo names stay inside)
// Switching between plain and encrypted is refused unless explicitly asked for,
// because data already committed in the clear stays in the git history.
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { decryptJson, encryptJson } from './crypto.mjs';
import { SCHEMA, emptyState } from './merge.mjs';

function writeAtomic(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, text);
  renameSync(tmp, path);
}

export function openStore(dir, { visibility, passphrase, migrate = false }) {
  const encrypted = visibility === 'encrypted';
  const plainPath = join(dir, 'state.json');
  const encPath = join(dir, 'state.enc');
  if (encrypted && !passphrase) throw new Error('encrypted mode needs MIMIR_PASSPHRASE');

  function load() {
    const hasPlain = existsSync(plainPath);
    const hasEnc = existsSync(encPath);
    if (encrypted && hasPlain && !migrate) {
      throw new Error('this data folder holds unencrypted data. Switching to "encrypted" does not remove what is already in the git history. Start a fresh data branch, or set MIMIR_MIGRATE=1 to convert anyway.');
    }
    if (!encrypted && hasEnc && !migrate) {
      throw new Error('this data folder holds encrypted data. Switching to an open mode publishes everything collected so far. Set MIMIR_MIGRATE=1 (with MIMIR_PASSPHRASE) to convert.');
    }
    let state;
    if (hasEnc && (encrypted || migrate)) {
      if (!passphrase) throw new Error('MIMIR_PASSPHRASE is needed to open the existing encrypted data');
      state = decryptJson(JSON.parse(readFileSync(encPath, 'utf8')), passphrase);
    } else if (hasPlain) {
      state = JSON.parse(readFileSync(plainPath, 'utf8'));
    } else {
      state = emptyState();
    }
    if (state.schema !== SCHEMA) throw new Error(`data is schema ${state.schema}; this version reads schema ${SCHEMA}`);
    return state;
  }

  function save(state) {
    if (encrypted) {
      writeAtomic(encPath, JSON.stringify(encryptJson(state, passphrase)) + '\n');
      if (existsSync(plainPath)) rmSync(plainPath);
    } else {
      writeAtomic(plainPath, JSON.stringify(state, null, 1) + '\n');
      if (existsSync(encPath)) rmSync(encPath);
    }
  }

  // Raw API answers, kept so derived figures can be recalculated later.
  function saveRaw(today, rawByRepo) {
    if (encrypted) {
      writeAtomic(join(dir, 'raw', `${today}.enc`), JSON.stringify(encryptJson(rawByRepo, passphrase)) + '\n');
    } else {
      for (const [repo, raw] of Object.entries(rawByRepo)) {
        writeAtomic(join(dir, 'raw', today, `${repo.replace('/', '__')}.json`), JSON.stringify(raw) + '\n');
      }
    }
  }

  return { load, save, saveRaw };
}
