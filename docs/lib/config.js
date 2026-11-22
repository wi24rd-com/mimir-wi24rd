// Validation of mimir.json. Shared by the collector, setup and the dashboard's
// settings panel, so all three agree on what a valid file is.

export const VISIBILITIES = ['public', 'encrypted', 'private'];
// What can be published in the open. The first three are single figures with a badge each;
// 'well' publishes what The Well is drawn from, for the front page.
export const BADGES = ['total_downloads', 'stars', 'repo_downloads', 'well'];
// The placeholder in the mimir.json that ships with Mimir. Setup refuses to run until it is replaced.
export const EXAMPLE_REPO = 'your-account/your-repository';
const REPO = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/;

export function validateConfig(cfg) {
  const fail = (m) => { throw new Error(`mimir.json: ${m}`); };
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) fail('must be a JSON object');
  if (cfg.version !== 1) fail('"version" must be 1');
  if (!VISIBILITIES.includes(cfg.visibility)) fail(`"visibility" must be one of ${VISIBILITIES.join(', ')}`);
  if (!Array.isArray(cfg.repos) || cfg.repos.length === 0) fail('"repos" must list at least one "owner/name"');
  if (cfg.repos.length > 100) fail('"repos" is limited to 100 entries');
  const seen = new Set();
  for (const r of cfg.repos) {
    if (typeof r !== 'string' || !REPO.test(r)) fail(`"${r}" is not a valid "owner/name"`);
    const key = r.toLowerCase();
    if (seen.has(key)) fail(`"${r}" is listed twice`);
    seen.add(key);
  }
  const owners = new Set(cfg.repos.map((r) => r.split('/')[0].toLowerCase()));
  if (owners.size !== 1) fail('all repos must belong to the same owner in this version');
  const badges = cfg.public_badges ?? [];
  if (!Array.isArray(badges)) fail('"public_badges" must be a list');
  for (const b of badges) if (!BADGES.includes(b)) fail(`unknown badge "${b}" (known: ${BADGES.join(', ')})`);
  return {
    version: 1,
    visibility: cfg.visibility,
    repos: [...cfg.repos],
    owner: cfg.repos[0].split('/')[0],
    public_badges: [...badges],
  };
}
