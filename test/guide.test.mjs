import test from 'node:test';
import assert from 'node:assert/strict';
import { guide, listRepos, needsGuide, parsePick, saveConfig } from '../src/guide.mjs';
import { validateConfig } from '../src/config.mjs';

const LIST = [
  { nameWithOwner: 'octo/zeta', visibility: 'PUBLIC' },
  { nameWithOwner: 'octo/alpha', visibility: 'PUBLIC' },
  { nameWithOwner: 'octo/secret-plans', visibility: 'PRIVATE' },
  { nameWithOwner: 'octo/mimir', visibility: 'PUBLIC' },
  { nameWithOwner: 'someone-else/odd', visibility: 'PUBLIC' },
];
// Scripted answers, a stand-in for the GitHub CLI, and everything that was said.
function world(answers, list = LIST) {
  const said = [];
  const asked = [];
  const calls = [];
  const queue = [...answers];
  return {
    said, asked, calls,
    say: (line) => said.push(line),
    ask: async (q) => { asked.push(q); if (!queue.length) throw new Error(`no answer left for: ${q}`); return queue.shift(); },
    gh: (args) => { calls.push(args); return { ok: true, out: JSON.stringify(list) }; },
  };
}
const PUBLIC = { nameWithOwner: 'octo/mimir', isPrivate: false };
const PRIVATE = { nameWithOwner: 'octo/mimir', isPrivate: true };

test('pick: numbers, commas, spans and "all"; anything else is not accepted', () => {
  assert.deepEqual(parsePick('1 3 5', 5), [0, 2, 4]);
  assert.deepEqual(parsePick(' 3,1 ,1', 5), [0, 2]);
  assert.deepEqual(parsePick('2-4 1', 5), [0, 1, 2, 3]);
  assert.deepEqual(parsePick('ALL', 3), [0, 1, 2]);
  assert.deepEqual(parsePick('', 3), []);
  for (const bad of ['0', '6', '4-2', 'one', '1;rm', '-1', '1-', '1.5', '99999', '106']) assert.equal(parsePick(bad, 5), null, bad);
  // Fewer than ten choices: digits written together are read one by one.
  assert.deepEqual(parsePick('1234', 4), [0, 1, 2, 3]);
  assert.deepEqual(parsePick('41 2', 4), [0, 1, 3]);
  assert.equal(parsePick('15', 4), null);
  // Ten or more: "12" is number twelve, and "1234" is not an answer.
  assert.deepEqual(parsePick('12', 18), [11]);
  assert.equal(parsePick('1234', 18), null);
});

test('a fresh copy needs the questions; a filled-in mimir.json does not', () => {
  assert.equal(needsGuide({ version: 1, visibility: 'encrypted', repos: ['your-account/your-repository'], public_badges: [] }), true);
  assert.equal(needsGuide({ repos: [] }), true);
  assert.equal(needsGuide({}), true);
  assert.equal(needsGuide({ version: 1, visibility: 'encrypted', repos: ['octo/alpha'] }), false);
});

test('the list holds the account\'s own repositories, sorted, with private ones marked', () => {
  const w = world([]);
  assert.deepEqual(listRepos('octo', w.gh), [
    { name: 'octo/alpha', private: false }, { name: 'octo/mimir', private: false }, { name: 'octo/secret-plans', private: true }, { name: 'octo/zeta', private: false },
  ]);
  assert.deepEqual(w.calls[0].slice(0, 5), ['repo', 'list', 'octo', '--source', '--no-archived']);
  assert.throws(() => listRepos('octo', () => ({ ok: false, out: '' })), /could not list/);
  assert.throws(() => listRepos('octo', () => ({ ok: true, out: '<html>' })), /did not answer/);
});

test('guide: the defaults give an encrypted setup that publishes nothing', async () => {
  const w = world(['1 3', '', '']);
  const { config, text } = await guide({ repo: PUBLIC, ask: w.ask, gh: w.gh, say: w.say });
  assert.deepEqual(config.repos, ['octo/alpha', 'octo/zeta']);
  assert.equal(config.visibility, 'encrypted');
  assert.deepEqual(config.public_badges, []);
  // The text is exactly what mimir.json will hold, and it is a valid one.
  assert.deepEqual(validateConfig(JSON.parse(text)), config);
  assert.ok(text.endsWith('}\n'));
  // The repository Mimir runs in is not offered, and it says so.
  const shown = w.said.join('\n');
  assert.ok(!/^\s+\d+\s+octo\/mimir$/m.test(shown));
  assert.match(shown, /octo\/mimir itself is left out/);
  assert.match(shown, /octo\/secret-plans {2}\(private\)/);
});

test('guide: public mode and published figures are chosen by number', async () => {
  const w = world(['all', '2', '2', '124']);
  const { config } = await guide({ repo: PUBLIC, ask: w.ask, gh: w.gh, say: w.say });
  assert.equal(config.visibility, 'public');
  assert.deepEqual(config.public_badges, ['total_downloads', 'stars', 'well']);
  assert.match(w.said.join('\n'), /This publishes views and clones/);
});

test('guide: a private repository name is not put in a public mimir.json without a clear yes', async () => {
  // Enter takes the recommended way: the private ones are left out.
  const out = world(['all', '', '', '']);
  assert.deepEqual((await guide({ repo: PUBLIC, ask: out.ask, gh: out.gh, say: out.say })).config.repos, ['octo/alpha', 'octo/zeta']);
  const shown = out.said.join('\n');
  assert.match(shown, /visible to everyone:/);
  assert.match(shown, /^ {6}octo\/secret-plans$/m);
  assert.match(shown, /Following 2: octo\/alpha, octo\/zeta/);
  // Following them takes the number 2, on purpose.
  const yes = world(['2', '2', '', '']);
  assert.deepEqual((await guide({ repo: PUBLIC, ask: yes.ask, gh: yes.gh, say: yes.say })).config.repos, ['octo/secret-plans']);
  const stop = world(['all', '3']);
  await assert.rejects(guide({ repo: PUBLIC, ask: stop.ask, gh: stop.gh, say: stop.say }), /Nothing was changed/);
  // Only private ones picked, and left out: there is nothing to follow.
  const none = world(['2', '1']);
  await assert.rejects(guide({ repo: PUBLIC, ask: none.ask, gh: none.gh, say: none.say }), /every repository you picked is private/);
});

test('guide: a private Mimir repository offers private and encrypted, and skips publishing', async () => {
  const w = world(['2', '']);
  const { config } = await guide({ repo: PRIVATE, ask: w.ask, gh: w.gh, say: w.say });
  assert.equal(config.visibility, 'private');
  assert.deepEqual(config.public_badges, []);
  assert.equal(w.asked.length, 2);
  assert.ok(!w.said.join('\n').includes('visible to everyone'));
  const enc = world(['1', '2']);
  assert.equal((await guide({ repo: PRIVATE, ask: enc.ask, gh: enc.gh, say: enc.say })).config.visibility, 'encrypted');
});

test('guide: an unreadable answer is asked again, and five in a row stop it', async () => {
  const w = world(['seven', '', '1', '9', '1', '']);
  const { config } = await guide({ repo: PUBLIC, ask: w.ask, gh: w.gh, say: w.say });
  assert.deepEqual(config.repos, ['octo/alpha']);
  assert.equal(config.visibility, 'encrypted');
  const stuck = world(['x', 'x', 'x', 'x', 'x']);
  await assert.rejects(guide({ repo: PUBLIC, ask: stuck.ask, gh: stuck.gh, say: stuck.say }), /five tries/);
  await assert.rejects(guide({ repo: PUBLIC, ask: w.ask, gh: () => ({ ok: true, out: JSON.stringify([LIST[3]]) }), say: w.say }), /no repositories to follow/);
});

// Records what would be written and which git commands would run.
function saver({ answers, fail = null }) {
  const done = [];
  const queue = [...answers];
  return {
    done,
    args: {
      text: '{\n  "version": 1\n}\n', say: () => {}, ask: async () => queue.shift() ?? '',
      write: (text) => done.push(['write', text]),
      git: (a) => { done.push(['git', ...a]); return { ok: fail !== a[0] }; },
      sh: (a) => { done.push(['sh', ...a]); return { ok: true }; },
    },
  };
}

test('save: nothing is written without a yes; with one it is saved, committed and pushed', async () => {
  const no = saver({ answers: ['n'] });
  await assert.rejects(saveConfig(no.args), /Nothing was changed/);
  assert.deepEqual(no.done, []);
  const yes = saver({ answers: [''] });
  await saveConfig(yes.args);
  assert.deepEqual(yes.done.map((d) => d.slice(0, 2).join(' ')), ['write {\n  "version": 1\n}\n', 'git add', 'git commit', 'git push']);
});

test('save: the fixed commit time is offered only where the tool is, is off unless chosen, and comes before the commit', async () => {
  const off = saver({ answers: ['', ''] });
  await saveConfig({ ...off.args, hasFixedTime: true });
  assert.ok(!off.done.some((d) => d[0] === 'sh'));
  const on = saver({ answers: ['y', 'y'] });
  await saveConfig({ ...on.args, hasFixedTime: true });
  assert.deepEqual(on.done[0], ['sh', 'tools/fast-tid.sh', 'install']);
  assert.equal(on.done.findIndex((d) => d[1] === 'commit') > 0, true);
});

test('save: a refused commit or push says what to do next', async () => {
  await assert.rejects(saveConfig(saver({ answers: [''], fail: 'commit' }).args), /could not be committed/);
  await assert.rejects(saveConfig(saver({ answers: [''], fail: 'push' }).args), /Run "git push"/);
});
