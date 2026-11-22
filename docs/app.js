// Wi24rd Mimir dashboard, built with Wi24rd UI Kit 2 (window.Kit, window.Tema,
// window.KitSprog from kit/). No requests to anyone but GitHub: the place the
// figures are stored, and one question about the workflow when collection has stopped. Everything shown is built with DOM nodes, never with HTML
// strings, because repository names and referrers are outside data.
import { BADGES, VISIBILITIES, validateConfig } from './lib/config.js';
import { demoState } from './lib/demo.js';
import { LANGS, TEXT, pickLang, plainTexts } from './lib/i18n.js';
import { WrongPassphrase, isEnvelope, openEnvelope } from './lib/open.js';
import { badgeCode, badgeList, pagesUrl, publicFigures, publicWell } from './lib/public.js';
import { qr, qrPath } from './lib/qr.js';
import { BioUnsupported, abilities, forget, recall, rememberBio, rememberPlain, remembered } from './lib/remember.js';
import { combineSeries, mergeReferrers, summarize } from './lib/summary.js';
import { VERSION } from './lib/version.js';
import { dropCount, pulsePath, rimStones, rippleCount, scaleSteps, sourcePoints } from './lib/well.js';

const { Kit, KitSprog, Tema } = window;
const SVG = 'http://www.w3.org/2000/svg';
const app = document.getElementById('app');

// English first. The kit's language engine fills in everything marked data-t;
// sentences that depend on the figures are built by the functions in i18n.js.
const Sprog = KitSprog.opret({ standard: 'en', titel: 'docTitle', tekst: Object.fromEntries(LANGS.map((l) => [l, plainTexts(l)])) });
window.Sprog = Sprog;
const L = () => TEXT[pickLang(Sprog.lang)];

Kit.registrerIkoner({ opdater: [['path', { d: 'M20 11a8 8 0 0 0-14.3-4.9L4 8' }], ['path', { d: 'M4 4v4h4' }], ['path', { d: 'M4 13a8 8 0 0 0 14.3 4.9L20 16' }], ['path', { d: 'M20 20v-4h-4' }]], telefon: [['rect', { x: 7, y: 3, width: 10, height: 18, rx: 2 }], ['path', { d: 'M11 17.5h2' }]] });

const VIEWS = ['overview', 'traffic', 'downloads', 'sources'];
const ui = { days: 14, state: null, pass: null, envelope: null, source: null, config: null, view: 'overview', repo: 'all', error: null,
  // public: the figures the owner published. can: what this device can remember. device: 'bio', 'plain' or null.
  public: null, can: { plain: false, bio: false }, device: null, front: false, locked: false, notice: null,
  // held: the demo's figures while its front page is shown. entered: the visitor went past the front page.
  // workflow: what GitHub says about the collecting workflow, asked only when collection looks stopped.
  held: null, entered: false, workflow: undefined };

// "?lang=da&theme=moerk&days=30&view=owner/name" opens the page in a given state.
const query = new URLSearchParams(location.search);
if (LANGS.includes(query.get('lang')) && query.get('lang') !== Sprog.lang) Sprog.saet(query.get('lang'));
if (Tema.VALG.includes(query.get('theme'))) document.documentElement.setAttribute('data-tema', query.get('theme'));
if (query.has('days')) ui.days = query.get('days') === 'all' ? null : [14, 30, 90].includes(Number(query.get('days'))) ? Number(query.get('days')) : 14;
if (query.has('repo')) ui.repo = query.get('repo');

function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...children.flat().filter((c) => c !== null && c !== undefined && c !== false));
  return el;
}
function s(tag, attrs = {}) {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

// ---------- where the figures come from ----------
async function getJson(url) {
  const res = await fetch(url, { cache: 'no-store', credentials: 'omit' });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function locate() {
  try {
    const source = await getJson('./mimir-source.json');
    if (source.mode === 'local') return { ...source, stateUrls: ['./data/state'], configUrl: './data/config', publicUrl: './data/public', workflowUrl: source.demo ? null : './data/workflow' };
  } catch { /* not served by the local command: assume GitHub Pages */ }
  // "?demo" shows invented figures, made in this browser. "?demo=front" starts on the page a visitor meets.
  if (query.has('demo')) return { mode: 'pages', demo: true, repository: null, branch: 'main', front: query.get('demo') === 'front' };
  const owner = location.hostname.split('.')[0];
  const repo = location.pathname.split('/').filter(Boolean)[0] ?? '';
  const raw = `https://raw.githubusercontent.com/${owner}/${repo}`;
  return { mode: 'pages', repository: `${owner}/${repo}`, branch: 'main', stateUrls: [`${raw}/data/state.enc`, `${raw}/data/state.json`], configUrl: `${raw}/main/mimir.json`, publicUrl: `${raw}/data/public.json`, front: true,
    workflowUrl: `https://api.github.com/repos/${owner}/${repo}/actions/workflows/collect.yml` };
}

// Asked once, and only when nothing has been collected for a while: has GitHub
// switched the collecting workflow off? The answer says why collection stopped.
async function askWorkflow() {
  ui.workflow = null;
  if (!ui.source?.workflowUrl) return;
  try {
    const answer = await getJson(ui.source.workflowUrl);
    if (typeof answer?.state === 'string' && /^[a-z_]{1,40}$/.test(answer.state)) ui.workflow = answer.state;
  } catch { /* no answer: the plain "collection has stopped" stays */ }
  if (ui.workflow && ui.workflow !== 'active') draw();
}

// The demo on GitHub Pages: the same invented figures as "--demo", with everything published.
function demoSource() {
  const state = demoState();
  const all = { version: 1, visibility: 'public', repos: Object.keys(state.repos), public_badges: [...BADGES] };
  const figures = publicFigures(all, state).map(({ id, repo, value }) => (repo ? { id, repo, value } : { id, value }));
  return { state, config: validateConfig(all), public: { mimir: 1, day: new Date().toISOString().slice(0, 10), figures, well: publicWell(all, state) } };
}

async function loadStateFile(source) {
  let last;
  for (const url of source.stateUrls) {
    try { return await getJson(url); } catch (e) { last = e; }
  }
  throw last ?? new Error('no source');
}

// ---------- chart ----------
// Top of the y-axis: four equal steps of a round size, so every tick is a whole number.
function niceMax(v) {
  const need = Math.max(1, v) / 4;
  const p = 10 ** Math.floor(Math.log10(need));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((x) => x >= need && Number.isInteger(x)) ?? 10 * p;
  return step * 4;
}
const narrow = matchMedia('(max-width: 899px)');
const shortDay = (day) => new Date(`${day}T00:00:00Z`).toLocaleDateString(Sprog.lang === 'da' ? 'da-DK' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function lineChart(series) {
  const t = L();
  const days = series[0].points.map((p) => p.day);
  const n = days.length;
  // On a narrow screen the chart is drawn at a smaller size so the text stays readable.
  const W = narrow.matches ? 380 : 720, H = narrow.matches ? 200 : 210, left = 40, right = 10, top = 10, bottom = 24;
  const pw = W - left - right, ph = H - top - bottom;
  const max = niceMax(Math.max(1, ...series.flatMap((x) => x.points.map((p) => p.count))));
  const x = (i) => left + (n === 1 ? pw / 2 : (i * pw) / (n - 1));
  const y = (v) => top + ph - (v / max) * ph;

  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', tabindex: '0', 'aria-label': `${series.map((x) => `${x.name}: ${t.num(x.total)}`).join(', ')}. ${shortDay(days[0])} – ${shortDay(days[n - 1])}` });
  for (let i = 0; i <= 4; i++) {
    const v = (max / 4) * i;
    svg.append(s('line', { class: 'gitter', x1: left, x2: W - right, y1: y(v), y2: y(v) }));
    const label = s('text', { class: 'akse', x: left - 8, y: y(v) + 4, 'text-anchor': 'end' });
    label.textContent = t.num(v);
    svg.append(label);
  }
  for (const [i, anchor] of [[0, 'start'], [Math.floor((n - 1) / 2), 'middle'], [n - 1, 'end']]) {
    if (n < 3 && anchor === 'middle') continue;
    const label = s('text', { class: 'akse', x: x(i), y: H - 6, 'text-anchor': anchor });
    label.textContent = shortDay(days[i]);
    svg.append(label);
  }
  for (const item of series) {
    let d = '';
    let pen = false;
    item.points.forEach((p, i) => {
      if (!p.known) { pen = false; return; }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.count).toFixed(1)}`;
      pen = true;
    });
    svg.append(s('path', { class: `linje ${item.cls}`, d }));
    // A lone known day has no line to show it, so it gets a marker.
    item.points.forEach((p, i) => {
      const alone = p.known && !item.points[i - 1]?.known && !item.points[i + 1]?.known;
      if (alone) svg.append(s('circle', { class: `prik ${item.cls}`, cx: x(i), cy: y(p.count), r: 4 }));
    });
  }
  const cross = s('line', { class: 'sigte', y1: top, y2: top + ph, visibility: 'hidden' });
  const dots = series.map((item) => s('circle', { class: `prik ${item.cls}`, r: 4.5, visibility: 'hidden' }));
  const hit = s('rect', { class: 'flade-hit', x: left, y: top, width: pw, height: ph });
  svg.append(cross, ...dots, hit);

  const tip = h('div', { class: 'mimir-tip', hidden: true });
  let current = -1;
  const show = (i) => {
    current = Math.max(0, Math.min(n - 1, i));
    cross.setAttribute('x1', x(current)); cross.setAttribute('x2', x(current)); cross.setAttribute('visibility', 'visible');
    series.forEach((item, k) => {
      const p = item.points[current];
      dots[k].setAttribute('cx', x(current)); dots[k].setAttribute('cy', y(p.count)); dots[k].setAttribute('visibility', p.known ? 'visible' : 'hidden');
    });
    tip.replaceChildren(h('div', {}, h('b', {}, shortDay(days[current]))), ...series.map((item) => {
      const p = item.points[current];
      return h('div', {}, h('span', {}, h('i', { class: item.cls }), item.name), h('b', {}, !p.known ? '–' : p.uniques === null ? t.num(p.count) : `${t.num(p.count)} (${t.num(p.uniques)} ${t.uniques})`));
    }));
    tip.hidden = false;
    const box = svg.getBoundingClientRect();
    const frame = tip.parentElement.getBoundingClientRect();
    const px = (x(current) / W) * box.width;
    const flip = px > box.width * 0.6;
    tip.style.left = `${box.left - frame.left + px + (flip ? -(tip.offsetWidth + 14) : 14)}px`;
    tip.style.top = `${box.top - frame.top + 12}px`;
  };
  const hide = () => { current = -1; tip.hidden = true; cross.setAttribute('visibility', 'hidden'); dots.forEach((dot) => dot.setAttribute('visibility', 'hidden')); };
  hit.addEventListener('pointermove', (e) => {
    const box = svg.getBoundingClientRect();
    const vx = ((e.clientX - box.left) / box.width) * W;
    show(n === 1 ? 0 : Math.round(((vx - left) / pw) * (n - 1)));
  });
  hit.addEventListener('pointerleave', hide);
  svg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { show(current < 0 ? n - 1 : current + 1); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { show(current < 0 ? n - 1 : current - 1); e.preventDefault(); }
    else if (e.key === 'Escape') hide();
  });
  svg.addEventListener('blur', hide);

  const table = Kit.tabel({
    raekkeHandling: 'ingen', layout: 'auto',
    kolonner: [{ tekst: t.day, hoved: true }, ...series.map((item) => ({ tekst: item.name, tal: true }))],
    raekker: days.map((day, i) => ({ celler: [day, ...series.map((item) => (!item.points[i].known ? '–' : item.points[i].uniques === null ? t.num(item.points[i].count) : `${t.num(item.points[i].count)} (${t.num(item.points[i].uniques)})`))], mono: [0] })).reverse(),
  });

  return h('div', { class: 'mimir-graf' },
    h('div', { class: 'mimir-forkl' }, series.map((item) => h('span', {}, h('i', { class: item.cls }), `${item.name} `, h('b', {}, t.num(item.total)), item.peak ? ` · ${t.peakUniques(t.num(item.peak))}` : ''))),
    svg, tip,
    h('details', {}, h('summary', {}, t.showTable), h('div', { class: 'mimir-rul' }, table)));
}

// ---------- shell ----------
// The same build as Wi24rd Grimnir and Huginn and Muninn: a dark title bar with
// the mark, the name and a few buttons; one ribbon whose tabs are the views and
// whose buttons are commands in named groups; a navigation pane that filters
// the work area; a toolbar, the content and a footer.
const shell = {};

function route() {
  const wanted = location.hash.slice(1);
  ui.view = VIEWS.includes(wanted) ? wanted : 'overview';
}
function pick(repo) { if (repo === ui.repo) return; ui.repo = repo; draw(); }

function titleButton({ icon, word, label, onclick }) {
  const b = h('button', { type: 'button', class: `rk${word ? ' mimir-ord' : ''}`, title: label, onclick });
  if (label) b.setAttribute('aria-label', label);
  if (icon) b.append(Kit.ikon(icon, 'ik'));
  if (word) b.append(word);
  return b;
}

function buildShell() {
  const t = L();
  const themeName = { lys: t.themeLight, moerk: t.themeDark, system: t.themeAuto }[Tema.valg];
  const right = h('span', { class: 'hoejre' },
    ui.source?.demo ? Kit.chip('info', t.demoWord) : null,
    titleButton({ word: t.languageWord, label: t.switchLanguage, onclick: () => { Sprog.saet(Sprog.lang === 'en' ? 'da' : 'en'); draw(); } }),
    ui.state && ui.envelope ? titleButton({ word: t.lockWord, label: t.lock, onclick: () => { ui.state = null; ui.pass = null; ui.locked = true; draw(); } }) : null,
    titleButton({ icon: { lys: 'sol', moerk: 'maane', system: 'skaerm' }[Tema.valg], label: t.themeNow(themeName), onclick: () => { Tema.saet(Tema.VALG[(Tema.VALG.indexOf(Tema.valg) + 1) % Tema.VALG.length]); draw(); } }),
    ui.state && ui.config ? titleButton({ icon: 'tandhjul', label: t.openSettings, onclick: openSettings }) : null);
  const title = h('header', { class: 'titel' }, h('span', { class: 'mrk-maske mimir-mrk', 'aria-hidden': 'true' }), h('b', {}, 'Wi24rd Mimir'), h('small', {}, t.tagline2), right);

  shell.band = h('div', {});
  shell.tree = h('ul', {});
  shell.nav = h('nav', { class: 'nav', 'aria-label': t.navAria }, h('h3', {}, t.navHeading), shell.tree);
  shell.bar = h('div', { class: 'vl' });
  shell.flade = h('div', { class: 'flade' });
  shell.foot = h('footer', { class: 'fodl' });
  app.replaceChildren(h('div', { class: 'vindue' }, title, shell.band,
    h('div', { class: 'midte' }, ui.state ? shell.nav : null, h('main', { class: 'arb' }, ui.state ? shell.bar : null, shell.flade, shell.foot))));
}

function buildBand() {
  const periods = [[14, 'range14'], [30, 'range30'], [90, 'range90'], [null, 'rangeAll']];
  const band = Kit.commandBar(shell.band, {
    ariaT: 'cmdAria', udenFaner: true, mere: { t: 'more' },
    visninger: { t: 'views_', som: 'faner', punkter: [{ id: 'overview', t: 'vOverview' }, { id: 'traffic', t: 'vTraffic' }, { id: 'downloads', t: 'vDownloads' }, { id: 'sources', t: 'vSources' }] },
    faner: [{ id: 'start', grupper: [
      { t: 'gData', knapper: [{ id: 'refresh', t: 'refresh', ikon: 'opdater', pri: true, ved: () => refetch() }] },
      { t: 'gPeriod', knapper: periods.map(([days, key]) => ({ id: `period-${days ?? 'all'}`, t: key, ikon: 'kalender', trykket: ui.days === days, ved: () => { if (ui.days !== days) { ui.days = days; draw(); } } })) },
      { t: 'gPhone', knapper: [{ id: 'phone', t: 'phone', ikon: 'telefon', ved: () => openPhone() }] },
    ] }],
  });
  band.visninger.markér(ui.view);
}

// ---------- views ----------
function toolbar(items, chipText) {
  const t = L();
  const picker = Kit.valgliste({ etiket: { t: 'show' }, valg: items.map((i) => (i.t ? { id: i.id, t: i.t } : { id: i.id, tekst: i.tekst })), valgt: ui.repo, vedValg: pick });
  shell.bar.replaceChildren(h('div', { class: 'mimir-smal' }, picker.rod), h('span', { class: 'hoejre' }, chipText ? Kit.chip('info', chipText) : null));
  return t;
}

// The start page: the totals in a sentence, The Well with the figures beside it,
// and under that a box per repository with its own chart.
function overviewView(summary, all) {
  const t = L();
  const [first, ...rest] = t.headline(summary);
  return { chip: t.nRepos(summary.repos.length), nodes: [h('h1', {}, first), h('p', { class: 'mimir-lede' }, rest.map((line) => h('span', {}, line))), ...wellView(summary, all).nodes, h('p', { class: 'mimir-note' }, t.uniquesNote)] };
}

function trafficView(summary) {
  const t = L();
  const one = summary.repos.length === 1 ? summary.repos[0] : null;
  const views = one ? one.viewSeries : combineSeries(summary.repos.map((r) => r.viewSeries));
  const clones = one ? one.cloneSeries : combineSeries(summary.repos.map((r) => r.cloneSeries));
  const days = Math.max(views.length, clones.length);
  if (!days) return { chip: t.nDays(0), nodes: [Kit.tomTilstand({ ikon: 'kalender', tekst: t.noTraffic })] };
  const blank = (points) => points.map((p) => ({ ...p, count: 0, uniques: null, known: false }));
  const chart = lineChart([
    { name: t.views, cls: 'mimir-s1', total: summary.totals.views, peak: one?.viewUniquesPeak, points: views.length ? views : blank(clones) },
    { name: t.clones, cls: 'mimir-s2', total: summary.totals.clones, peak: one?.cloneUniquesPeak, points: clones.length ? clones : blank(views) },
  ]);
  return { chip: t.nDays(days), nodes: [Kit.kasse({ t: 'chartTitle', indhold: chart, fyld: true }).rod, h('p', { class: 'mimir-note' }, one ? t.uniquesNote : t.combinedNote)] };
}

function downloadsView(summary) {
  const t = L();
  const many = summary.repos.length > 1;
  const files = summary.repos.flatMap((r) => r.files.map((f) => ({ ...f, repo: r.short })));
  if (!files.length) return { chip: t.nFiles(0), nodes: [Kit.tomTilstand({ ikon: 'fil', tekst: many ? t.noFilesAll : t.noFiles })] };
  const marked = (f) => ui.days && f.partial;
  const table = Kit.tabel({
    titelT: 'tableFiles', raekkeHandling: 'ingen', layout: 'auto', fastFoerste: true,
    kolonner: [{ t: 'file', hoved: true }, ...(many ? [{ t: 'repository' }] : []), { t: 'release' }, { t: 'total', tal: true }, { t: 'inPeriod', tal: true }],
    raekker: files.map((f) => ({ celler: [f.name, ...(many ? [f.repo] : []), f.tag, t.num(f.total), `+${t.num(f.gained)}${marked(f) ? '*' : ''}`], mono: [many ? 2 : 1] })),
  });
  return { chip: t.nFiles(files.length), nodes: [Kit.tabelRul(table, { ariaT: 'tableScroll' }).rod, files.some(marked) ? h('p', { class: 'mimir-note' }, t.partialNote) : null] };
}

function sourcesView(summary) {
  const t = L();
  const one = summary.repos.length === 1 ? summary.repos[0] : null;
  const refs = one ? one.referrers : mergeReferrers(summary.repos);
  const day = summary.repos.map((r) => r.referrersDay).filter(Boolean).sort().pop();
  const refTable = refs.length
    ? Kit.tabelRul(Kit.tabel({
      titelT: 'tableRefs', raekkeHandling: 'ingen', layout: 'auto',
      kolonner: [{ t: 'source', hoved: true }, { t: 'visits', tal: true }, ...(one ? [{ t: 'uniqueCol', tal: true }] : [])],
      raekker: refs.map((x) => ({ celler: [x.referrer, t.num(x.count), ...(one ? [t.num(x.uniques)] : [])] })),
    }), { ariaT: 'tableScroll' }).rod
    : Kit.tomTilstand({ lille: true, ikon: 'soeg', tekst: t.noReferrers });
  const pages = summary.repos.flatMap((r) => r.paths.map((x) => ({ ...x, repo: r.short }))).sort((a, b) => b.count - a.count).slice(0, 10);
  const pageTable = pages.length
    ? Kit.tabelRul(Kit.tabel({
      titelT: 'pages', raekkeHandling: 'ingen', layout: 'auto',
      kolonner: [{ t: 'page', hoved: true }, { t: 'views', tal: true }, { t: 'uniqueCol', tal: true }],
      raekker: pages.map((x) => ({ celler: [x.path, t.num(x.count), t.num(x.uniques)], mono: [0] })),
    }), { ariaT: 'tableScroll' }).rod
    : Kit.tomTilstand({ lille: true, ikon: 'fil', tekst: t.noPages });
  return { chip: t.nSources(refs.length), nodes: [
    h('div', { class: 'mimir-to' }, Kit.kasse({ t: 'referrers', indhold: refTable, fyld: true }).rod, Kit.kasse({ t: 'pages', indhold: pageTable, fyld: true }).rod),
    day ? h('p', { class: 'mimir-note' }, `${t.referrersNote(day)}${one ? '' : ` ${t.combinedNote}`}`) : null,
  ] };
}

// One repository on its own: the chart of its views and clones, and its downloads and stars.
function repoCard(r) {
  const t = L();
  const blank = (points) => points.map((p) => ({ ...p, count: 0, uniques: null, known: false }));
  const chart = r.viewSeries.length || r.cloneSeries.length
    ? lineChart([
      { name: t.views, cls: 'mimir-s1', total: r.views, peak: r.viewUniquesPeak, points: r.viewSeries.length ? r.viewSeries : blank(r.cloneSeries) },
      { name: t.clones, cls: 'mimir-s2', total: r.clones, peak: r.cloneUniquesPeak, points: r.cloneSeries.length ? r.cloneSeries : blank(r.viewSeries) },
    ])
    : Kit.tomTilstand({ lille: true, ikon: 'kalender', tekst: t.noTraffic });
  const facts = h('p', { class: 'mimir-fakta' },
    h('span', {}, `${t.downloads} `, h('b', {}, t.num(r.downloads))),
    h('span', {}, `${t.inPeriod} `, h('b', {}, `+${t.num(r.downloadsGained)}`)),
    h('span', {}, `${t.stars} `, h('b', {}, t.num(r.stars))));
  const details = Kit.knap({ tekst: t.wellDetails, variant: 'ghost', aria: t.wellDetailsOf(r.short), ved: () => { ui.repo = r.name; location.hash = 'traffic'; } });
  return Kit.kasse({ tekst: r.short, niveau: 3, handling: details, indhold: h('div', {}, chart, facts), fyld: true }).rod;
}

// ---------- the well ----------
// Mimir's well seen from above, drawn from the figures (geometry in lib/well.js).
// It is the picture on the start page: the table beside it holds the same numbers.
const still = matchMedia('(prefers-reduced-motion: reduce)');

// pickable: false on the public front page, where there is one picture and nothing to filter.
function wellView(summary, all, pickable = true) {
  const t = L();
  const C = { cx: 300, cy: 300 };
  const repos = all.repos;
  const chosen = pickable && ui.repo !== 'all' ? ui.repo : null;
  const daily = combineSeries(summary.repos.map((r) => r.viewSeries));
  const steps = scaleSteps(Math.max(0, ...daily.map((p) => p.count)));
  const busiest = Math.max(0, ...repos.map((r) => r.views));
  const svg = s('svg', { viewBox: '0 0 600 600', role: 'img', 'aria-label': t.wellAria(t.num(summary.totals.views), t.nRepos(summary.repos.length)) });

  const defs = s('defs');
  const water = s('radialGradient', { id: 'b-vand', cx: '50%', cy: '46%', r: '62%' });
  water.append(s('stop', { offset: '0%', class: 'b-v1' }), s('stop', { offset: '70%', class: 'b-v2' }), s('stop', { offset: '100%', class: 'b-v3' }));
  const glow = s('filter', { id: 'b-gloed', x: '-20%', y: '-60%', width: '140%', height: '220%' });
  glow.append(s('feGaussianBlur', { stdDeviation: '5', result: 'b' }));
  const merge = s('feMerge'); merge.append(s('feMergeNode', { in: 'b' }), s('feMergeNode', { in: 'SourceGraphic' })); glow.append(merge);
  const clip = s('clipPath', { id: 'b-klip' }); clip.append(s('circle', { cx: C.cx, cy: C.cy, r: 238 }));
  defs.append(water, glow, clip);
  svg.append(defs);

  // Rim: one stone per day.
  svg.append(s('circle', { class: 'b-kant', cx: C.cx, cy: C.cy, r: 291 }));
  const tip = h('div', { class: 'mimir-tip', hidden: true });
  const showTip = (el, lines) => {
    tip.replaceChildren(...lines.map(([a, b], i) => (i === 0 ? h('div', {}, h('b', {}, a)) : h('div', {}, h('span', {}, a), h('b', {}, b)))));
    tip.hidden = false;
    const box = el.getBoundingClientRect();
    const frame = tip.parentElement.getBoundingClientRect();
    const left = Math.max(4, Math.min(frame.width - tip.offsetWidth - 4, box.left - frame.left + box.width / 2 - tip.offsetWidth / 2));
    tip.style.left = `${left}px`;
    tip.style.top = `${Math.max(4, box.top - frame.top - tip.offsetHeight - 8)}px`;
  };
  const hideTip = () => { tip.hidden = true; };
  const stones = rimStones(daily, { ...C, r0: 250, r1: 284 });
  for (const stone of stones) {
    const path = s('path', { class: `b-sten n${stone.level}`, d: stone.d });
    path.addEventListener('pointerenter', () => showTip(path, [[shortDay(stone.day)], [t.views, stone.known ? t.num(stone.count) : '–']]));
    path.addEventListener('pointerleave', hideTip);
    svg.append(path);
  }
  if (stones.length) {
    const last = stones[stones.length - 1];
    const x = C.cx + 296 * Math.cos(last.mid), y = C.cy + 296 * Math.sin(last.mid);
    svg.append(s('circle', { class: 'b-idag', cx: x.toFixed(1), cy: y.toFixed(1), r: 4 }));
  }

  // Water, and on it the pulse: views per day.
  svg.append(s('circle', { class: 'b-vand', cx: C.cx, cy: C.cy, r: 240 }));
  const onWater = s('g', { 'clip-path': 'url(#b-klip)' });
  svg.append(onWater);
  const pulse = pulsePath(daily, { x0: 96, x1: 504, y: C.cy, amp: 46 });
  if (pulse) {
    onWater.append(s('path', { class: 'b-puls-skygge', d: pulse }), s('path', { class: 'b-puls', d: pulse, pathLength: 1 }));
    if (!still.matches) {
      const dot = s('circle', { class: 'b-puls-prik', r: 4 });
      const move = s('animateMotion', { dur: '7s', repeatCount: 'indefinite', path: pulse, calcMode: 'linear' });
      dot.append(move);
      onWater.append(dot);
    }
  }

  // Repositories: a point each, with rings for views, a dashed ring for clones and drops for downloads.
  const points = sourcePoints(repos.length, { ...C, r: repos.length > 1 ? 138 : 0 });
  repos.forEach((r, i) => {
    const p = points[i];
    const dim = chosen && chosen !== r.name;
    const g = s('g', { class: `b-kilde${dim ? ' b-dim' : ''}`, tabindex: '0', role: pickable ? 'button' : 'img', 'aria-label': `${r.short}: ${t.num(r.views)} ${t.views.toLowerCase()}, ${t.num(r.clones)} ${t.clones.toLowerCase()}, +${t.num(r.downloadsGained)} ${t.downloads.toLowerCase()}` });
    const rings = rippleCount(r.views, busiest);
    const reach = 26 + rings * 13;
    for (let k = 0; k < rings; k++) {
      const ring = s('circle', { class: 'b-ring', cx: p.x, cy: p.y, r: reach });
      ring.style.setProperty('--dur', `${(7.5 - rings * 0.7).toFixed(1)}s`);
      ring.style.setProperty('--delay', `${(-(k * (7.5 - rings * 0.7)) / rings).toFixed(2)}s`);
      ring.style.setProperty('--rest', String(((k + 1) / rings).toFixed(2)));
      g.append(ring);
    }
    if (r.clones > 0) g.append(s('circle', { class: 'b-klon', cx: p.x, cy: p.y, r: 15 }));
    const drops = dropCount(r.downloadsGained);
    for (let k = 0; k < drops; k++) {
      const a = (k / Math.max(1, drops)) * 2 * Math.PI + i;
      const drop = s('circle', { class: 'b-draabe', cx: (p.x + 24 * Math.cos(a)).toFixed(1), cy: (p.y + 24 * Math.sin(a)).toFixed(1), r: 3.2 });
      drop.style.setProperty('--delay', `${(-(k * 0.83) - i * 0.4).toFixed(2)}s`);
      g.append(drop);
    }
    g.append(s('circle', { class: 'b-kerne', cx: p.x, cy: p.y, r: 6 }));
    const label = s('text', { class: 'b-navn', x: p.x, y: p.y + (p.y > C.cy + 20 ? 34 : -22), 'text-anchor': 'middle' });
    label.textContent = r.short.length > 20 ? `${r.short.slice(0, 19)}…` : r.short;
    g.append(label);
    const lines = [[r.short], [t.views, t.num(r.views)], [t.clones, t.num(r.clones)], [t.downloads, `+${t.num(r.downloadsGained)}`]];
    g.addEventListener('pointerenter', () => showTip(g.querySelector('.b-kerne'), lines));
    g.addEventListener('focus', () => showTip(g.querySelector('.b-kerne'), lines));
    g.addEventListener('pointerleave', hideTip);
    g.addEventListener('blur', hideTip);
    const open = () => pick(chosen === r.name ? 'all' : r.name);
    if (pickable) {
      g.addEventListener('click', open);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    }
    svg.append(g);
  });

  // Beside it: how to read it, the scale with numbers, and the same figures as a table.
  const swatch = (cls) => { const i = s('svg', { viewBox: '0 0 16 16', class: 'b-prove', 'aria-hidden': 'true' }); i.append(s('rect', { class: cls, x: 1, y: 1, width: 14, height: 14, rx: 3 })); return i; };
  const scale = h('ul', { class: 'b-skala' }, h('li', {}, swatch('b-sten n0'), t.wellNoViews), steps.map((st) => h('li', {}, swatch(`b-sten n${st.level}`), st.from === st.to ? t.num(st.from) : `${t.num(st.from)}–${t.num(st.to)}`)));
  const reading = h('div', { class: 'b-forkl' },
    h('p', {}, t.wellRim), h('div', {}, h('span', { class: 'label' }, t.wellScale), scale),
    h('p', {}, t.wellPulse), h('p', {}, t.wellRipples), h('p', {}, t.wellClones), h('p', {}, t.wellDrops),
    still.matches ? h('p', { class: 'muted' }, t.wellStill) : null);
  const table = Kit.tabel({
    titelT: 'tableRepos', raekkeHandling: pickable ? 'aabn' : 'ingen', vedAabn: (tr, data) => { ui.repo = data; location.hash = 'traffic'; }, layout: 'auto',
    kolonner: [{ t: 'repository', hoved: true }, { t: 'views', tal: true }, { t: 'clones', tal: true }, { t: 'downloadsInPeriod', tal: true }],
    raekker: repos.map((r) => ({ celler: [r.short, t.num(r.views), t.num(r.clones), `+${t.num(r.downloadsGained)}`], data: r.name })),
  });
  const side = h('div', { class: 'b-side' }, Kit.kasse({ t: 'repositories', indhold: Kit.tabelRul(table, { ariaT: 'tableScroll' }).rod, fyld: true }).rod, Kit.kasse({ t: 'wellReading', indhold: reading }).rod);
  const nodes = [h('div', { class: 'mimir-broend' }, h('div', { class: 'b-billede' }, svg, tip), side)];
  // Below the picture: each repository with its own chart, to scroll through. The
  // published Well on the front page has no figures per day for each, so not there.
  if (pickable) {
    const shown = chosen ? repos.filter((r) => r.name === chosen) : repos;
    if (shown.length) nodes.push(h('h2', { class: 'mimir-afsnit' }, chosen ? t.wellOne : t.wellEach), h('div', { class: 'mimir-hver' }, shown.map(repoCard)));
  }
  return { chip: t.nDays(daily.length), nodes };
}

// The repository Mimir runs in, as "owner/name". The demo has none.
const home = () => ui.source?.repository ?? 'example/mimir';

function copyField(value, label) {
  const t = L();
  const code = h('code', { tabindex: '0' }, value);
  const button = Kit.knap({ tekst: t.copy, ikon: 'kopier', ved: () => {
    navigator.clipboard?.writeText(value).then(() => { button.querySelector('span').textContent = L().copied; }, () => {
      const range = document.createRange(); range.selectNodeContents(code); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
    });
  } });
  return h('div', { class: 'mimir-kode' }, label ? h('span', { class: 'label' }, label) : null, h('div', { class: 'k-linje' }, code, button));
}

// Opens the figures with what this device remembers. Returns null, or the key
// of the sentence that says why it did not work.
async function openRemembered() {
  try {
    const pass = await recall();
    ui.state = await openEnvelope(ui.envelope, pass);
    ui.pass = pass;
    ui.locked = false;
    return null;
  } catch (e) {
    if (e instanceof WrongPassphrase) { await forget(); ui.device = null; return 'rememberStale'; }
    return e instanceof BioUnsupported ? 'bioUnsupported' : 'recallFailed';
  }
}

// kind: 'field' for a wrong passphrase, otherwise the banner variant to show the message in.
function showLock(message, kind = 'field') {
  shell.flade.replaceChildren(unlockView(message, kind));
  Sprog.anvend(shell.flade);
}

function unlockView(message, kind = 'field') {
  const t = L();
  const field = Kit.felt({ etiket: { t: 'passphrase' }, foelsom: true, mono: true, fejl: (kind === 'field' && message) || undefined });
  const note = message && kind !== 'field' ? Kit.banner({ variant: kind, tekst: message }) : null;
  // The demo looks like the real thing, so it says what it is: your own passphrase does not open it.
  const demo = ui.source?.demo ? Kit.banner({ variant: 'info', tekst: t.unlockDemo }) : null;
  const input = field.querySelector('input');
  input.type = 'password';
  input.setAttribute('autocomplete', 'current-password');
  const button = Kit.knap({ t: ui.device ? 'unlockWithPassphrase' : 'unlock', variant: ui.device ? undefined : 'primary', ved: submit });

  // Offered only when nothing is remembered yet and the browser can keep it.
  let remember = null;
  let bio = null;
  const plainWarning = h('p', { class: 'hj', 'data-t': 'rememberPlainHelp' });
  const extra = h('div', { class: 'mimir-husk', hidden: true });
  const sync = () => { extra.hidden = !remember?.valgt; plainWarning.hidden = Boolean(bio?.valgt); };
  if (ui.can.plain && !ui.device) {
    remember = Kit.afkrydsning({ t: 'rememberDevice', valgt: false, vedSkift: sync });
    if (ui.can.bio) bio = Kit.afkrydsning({ t: 'rememberBio', hjaelp: { t: 'rememberBioHelp' }, valgt: true, vedSkift: sync });
    extra.append(...[bio?.rod, plainWarning, h('p', { class: 'hj' }, t.rememberShared(location.host))].filter(Boolean));
    sync();
  }

  async function submit() {
    const pass = input.value.trim();
    if (button.disabled || !pass) { input.focus(); return; }
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    try {
      ui.state = await openEnvelope(ui.envelope, pass);
      // Kept in this tab's memory, so "Fetch again" can open the new file. Locking forgets it.
      ui.pass = pass;
      ui.locked = false;
    } catch (err) {
      showLock(err instanceof WrongPassphrase ? t.wrongPassphrase : `${t.loadFailed} (${err.message})`);
      shell.flade.querySelector('input').focus();
      return;
    }
    if (remember?.valgt) {
      try {
        if (bio?.valgt) await rememberBio(pass, t.passkeyName(home()));
        else await rememberPlain(pass);
        ui.device = await remembered();
        ui.notice = { variant: 'ok', key: ui.device === 'bio' ? 'rememberDoneBio' : 'rememberDonePlain' };
      } catch (err) {
        // The passphrase is still in this tab, so remembering without the check can be offered right away.
        ui.notice = { variant: 'warn', key: err instanceof BioUnsupported ? 'bioUnsupported' : 'rememberFailed', action: bio?.valgt ? 'rememberPlainNow' : null };
      }
    }
    draw();
  }
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });

  if (!ui.device) {
    return h('div', { class: 'mimir-laas' }, h('h1', { 'data-t': 'unlockTitle' }), h('p', { 'data-t': 'unlockBody' }), demo, note, field, remember?.rod, extra, button);
  }
  // Something is remembered: one button opens the figures; the passphrase still works.
  const open = Kit.knap({ t: ui.device === 'bio' ? 'openBio' : 'openRemembered', variant: 'primary', ved: async () => {
    if (open.disabled) return;
    open.disabled = true;
    open.setAttribute('aria-busy', 'true');
    const problem = await openRemembered();
    if (problem) showLock(L()[problem], 'warn'); else draw();
  } });
  const drop = Kit.knap({ t: 'forgetDevice', variant: 'ghost', ved: async () => { await forget(); ui.device = null; showLock(L().forgotten, 'info'); } });
  return h('div', { class: 'mimir-laas' }, h('h1', { 'data-t': 'unlockTitle' }), h('p', { 'data-t': ui.device === 'bio' ? 'unlockBodyBio' : 'unlockBodyPlain' }),
    demo, note, open,
    h('p', { class: 'hj', 'data-t': 'orPassphrase' }), field, button, drop);
}

// The published Well, checked field by field because public.json is outside data,
// and shaped like the summaries the drawing takes. Null when there is none.
function publishedWell() {
  const w = ui.public?.well;
  const count = (v) => Number.isFinite(v) && v >= 0;
  if (!w || !Array.isArray(w.daily) || !Array.isArray(w.repos) || w.daily.length > 31 || w.repos.length > 100) return null;
  const daily = w.daily.filter((p) => p && /^\d{4}-\d{2}-\d{2}$/.test(p.day) && (p.views === null || count(p.views)));
  const repos = w.repos.filter((r) => r && typeof r.name === 'string' && count(r.views) && count(r.clones) && count(r.downloads));
  if (!daily.length || !repos.length || daily.length !== w.daily.length || repos.length !== w.repos.length) return null;
  const list = repos.map((r) => ({ name: r.name, short: r.name.split('/').pop(), views: r.views, clones: r.clones, downloadsGained: r.downloads, viewSeries: [] }));
  list[0].viewSeries = daily.map((p) => ({ day: p.day, count: p.views ?? 0, uniques: null, known: p.views !== null }));
  const summary = { repos: list, totals: { views: list.reduce((n, r) => n + r.views, 0) } };
  return { summary, days: daily.length };
}

// What a visitor meets on GitHub Pages when the figures are encrypted: the
// few figures the owner chose to publish, and the way in for the owner.
function frontView() {
  const t = L();
  const known = { total_downloads: () => t.badgeDownloads, stars: () => t.badgeStars, repo_downloads: (f) => t.figRepoDownloads(String(f.repo ?? '').split('/').pop()) };
  const figures = (Array.isArray(ui.public?.figures) ? ui.public.figures : []).filter((f) => f && known[f.id] && Number.isFinite(f.value));
  const well = publishedWell();
  const nodes = [h('h1', { 'data-t': 'frontTitle' }), h('p', { 'data-t': figures.length || well ? 'frontBody' : 'frontBodyNone' })];
  // The way in comes first, so the owner does not have to scroll past the picture.
  if (ui.held) nodes.push(Kit.banner({ variant: 'info', tekst: t.frontDemo }));
  nodes.push(Kit.knap({ t: 'frontOpen', variant: 'primary', ikon: 'laas', ved: () => { ui.front = false; ui.entered = true; if (ui.held) { ui.state = ui.held; ui.held = null; } draw(); } }));
  if (well) nodes.push(h('p', { class: 'hj' }, t.frontWell(well.days)), ...wellView(well.summary, well.summary, false).nodes);
  if (figures.length) {
    const table = Kit.tabel({
      titelT: 'frontFigures', raekkeHandling: 'ingen', layout: 'auto',
      kolonner: [{ t: 'figure', hoved: true }, { t: 'value', tal: true }],
      raekker: figures.map((f) => ({ celler: [known[f.id](f), t.num(f.value)] })),
    });
    nodes.push(Kit.tabelRul(table, { ariaT: 'tableScroll' }).rod);
  }
  if ((figures.length || well) && /^\d{4}-\d{2}-\d{2}$/.test(ui.public.day ?? '')) nodes.push(h('p', { class: 'hj' }, t.frontAsOf(shortDay(ui.public.day))));
  return h('div', { class: `mimir-laas mimir-forside${well ? ' bred' : ''}` }, nodes);
}

function footer(all) {
  const t = L();
  const left = all ? `${t.nRepos(all.repos.length)} · ${all.health.lastRun ? t.collected(t.hoursAgo(all.health.ageHours)) : t.never}` : '';
  shell.foot.replaceChildren(h('span', {}, left), h('span', { class: 'h' }, h('span', {}, Kit.ikon('laas'), t.footOnly), h('span', {}, t.footVersion(VERSION))));
}

function draw() {
  route();
  buildShell();
  const t = L();
  if (ui.error) {
    // On GitHub Pages a copy that has not collected yet lands here, so the demo is offered.
    const demo = ui.source?.mode === 'pages' ? { t: 'tryDemo', ved: () => { location.search = '?demo'; } } : undefined;
    shell.flade.replaceChildren(Kit.tomTilstand({ ikon: 'mappe', t: 'loadFailed', p: { t: 'loadFailedHelp' }, handling: { t: 'refresh', variant: 'primary', ved: () => start() }, anden: demo }));
    footer(null);
  } else if (!ui.state && (ui.envelope || (ui.held && ui.front))) {
    const notice = ui.notice;
    ui.notice = null;
    shell.flade.replaceChildren(ui.front ? frontView() : unlockView(notice ? t[notice.key] : undefined, notice?.variant ?? 'field'));
    footer(null);
  } else if (ui.state) {
    const all = summarize(ui.state, { days: ui.days });
    if (ui.repo !== 'all' && !all.repos.some((r) => r.name === ui.repo)) ui.repo = 'all';
    // The navigation pane filters every view: all repositories, or one.
    const summary = ui.repo === 'all' ? all : summarize({ ...ui.state, repos: { [ui.repo]: ui.state.repos[ui.repo] } }, { days: ui.days });
    buildBand();
    const items = [{ id: 'all', t: 'allRepos', antal: all.repos.length }, ...all.repos.map((r) => ({ id: r.name, tekst: r.short, antal: t.num(r.views) }))];
    Kit.navTrae(shell.tree, items, { ariaT: 'navAria', valgt: ui.repo, vedValg: pick });

    const page = h('div', { class: 'mimir-side' });
    if (ui.notice) {
      const handling = ui.notice.action === 'rememberPlainNow' && ui.pass
        ? { tekst: t.rememberPlainNow, ved: async () => {
          try { await rememberPlain(ui.pass); ui.device = await remembered(); ui.notice = { variant: 'ok', key: 'rememberDonePlain' }; }
          catch { ui.notice = { variant: 'warn', key: 'rememberFailed' }; }
          draw();
        } }
        : undefined;
      page.append(Kit.banner({ variant: ui.notice.variant, tekst: ui.notice.text ?? t[ui.notice.key], handling }));
      ui.notice = null;
    }
    if (all.health.stale && all.health.lastRun) {
      if (ui.workflow === undefined) askWorkflow();
      const paused = ui.workflow && ui.workflow !== 'active';
      const actions = `https://github.com/${home()}/actions/workflows/collect.yml`;
      page.append(paused
        ? Kit.banner({ variant: 'danger', tekst: `${t.staleTitle}. ${ui.workflow === 'disabled_inactivity' ? t.pausedInactive : t.pausedOff}`, handling: { tekst: t.pausedOpen, ved: () => { window.open(actions, '_blank', 'noopener,noreferrer'); } } })
        : Kit.banner({ variant: 'danger', tekst: `${t.staleTitle}. ${t.staleBody(Math.round(all.health.ageHours))}` }));
    }
    for (const e of all.health.errors) page.append(Kit.banner({ variant: 'warn', tekst: t.errorLine(e) }));
    let chip = null;
    if (!all.repos.length) {
      page.append(Kit.tomTilstand({ ikon: 'kalender', t: 'emptyTitle', p: { t: 'noData' } }));
    } else {
      const view = { overview: (x) => overviewView(x, all), traffic: trafficView, downloads: downloadsView, sources: sourcesView }[ui.view](summary);
      chip = view.chip;
      page.append(...view.nodes.filter(Boolean));
    }
    toolbar(items, chip);
    shell.flade.replaceChildren(page);
    footer(all);
  }
  Sprog.anvend(document);
  if (!ui.state && ui.envelope && !ui.front && !ui.device) shell.flade.querySelector('input')?.focus();
}

// ---------- phone ----------
function openPhone() {
  const t = L();
  const onPages = ui.source.mode === 'pages';
  const url = onPages ? `${location.origin}${location.pathname.replace(/[^/]*$/, '')}` : pagesUrl(home());
  const code = qr(url);
  const { d, box } = qrPath(code);
  const svg = s('svg', { viewBox: `0 0 ${box} ${box}`, class: 'mimir-qr', role: 'img', 'aria-label': t.qrAria(url) });
  svg.append(s('rect', { class: 'q-lys', width: box, height: box }), s('path', { class: 'q-moerk', d }));
  let dialog;
  const device = h('div', {});
  const showDevice = () => {
    device.replaceChildren(...(ui.device
      ? [h('p', { class: 'hj' }, ui.device === 'bio' ? t.deviceBio : t.devicePlain), Kit.knap({ tekst: t.forgetDevice, ved: async () => { await forget(); ui.device = null; showDevice(); } })]
      : [h('p', { class: 'hj' }, ui.envelope ? t.deviceNone : t.deviceOpen)]));
  };
  showDevice();
  const body = h('div', { class: 'mimir-tlf' }, svg,
    h('div', { class: 'mimir-tlf-tekst' },
      copyField(url, t.address),
      onPages ? null : Kit.banner({ variant: 'info', tekst: ui.source.demo ? t.phoneDemo : t.phoneLocal }),
      h('ol', {}, h('li', {}, t.phoneStep1), h('li', {}, t.phoneStep2), h('li', {}, t.phoneStep3)),
      device));
  dialog = Kit.dialog({ t: 'phoneTitle', p: { t: 'phoneIntro' }, bred: true, indhold: body, luk: { ariaT: 'close' }, knapper: [{ id: 'close', t: 'close' }], vedLuk: () => dialog.rod.remove() });
  Sprog.anvend(dialog.rod);
  dialog.aabn();
}

// ---------- settings ----------
function openSettings() {
  const t = L();
  const current = ui.config;
  const repos = h('textarea', { id: 'mimir-repos', class: 'mono', spellcheck: false, value: current.repos.join('\n') });
  const reposField = h('div', { class: 'felt' }, h('label', { class: 'label', for: 'mimir-repos', 'data-t': 'trackedRepos' }), repos, h('span', { class: 'hj', 'data-t': 'trackedReposHelp' }));
  const labels = { encrypted: 'visEncrypted', public: 'visPublic', private: 'visPrivate' };
  const badgeLabels = { total_downloads: 'badgeDownloads', stars: 'badgeStars', repo_downloads: 'badgeRepoDownloads', well: 'badgeWell' };
  const warnWell = h('div', {});
  const codes = h('div', { class: 'mimir-koder' });
  const out = h('pre', { tabindex: '0' });
  const warn = h('div', {});
  let text = '';
  let dialog;
  const vis = Kit.radiogruppe({ etiket: { t: 'visibility' }, valg: ['encrypted', 'public', 'private'].filter((v) => VISIBILITIES.includes(v)).map((v) => ({ id: v, t: labels[v] })), valgt: current.visibility, vedValg: () => update() });
  const badges = BADGES.map((b) => ({ id: b, box: Kit.afkrydsning({ t: badgeLabels[b], valgt: (current.public_badges ?? []).includes(b), vedSkift: () => update() }) }));
  function update() {
    const next = { version: 1, visibility: vis.valgt, repos: repos.value.split('\n').map((line) => line.trim()).filter(Boolean), public_badges: badges.filter((b) => b.box.valgt).map((b) => b.id) };
    // Publishing The Well opens traffic figures that are otherwise for the owner only.
    const addsWell = next.public_badges.includes('well') && !(current.public_badges ?? []).includes('well') && next.visibility === 'encrypted';
    warnWell.replaceChildren(...(addsWell ? [Kit.banner({ variant: 'warn', tekst: t.wellPublicWarn })] : []));
    const wasOpen = current.visibility !== 'encrypted';
    const isOpen = next.visibility !== 'encrypted';
    warn.replaceChildren(...(wasOpen === isOpen ? [] : [Kit.banner({ variant: 'warn', tekst: `${isOpen ? t.visWarnOpen : t.visWarnEncrypt} ${t.visNeedsFlag}` })]));
    try {
      const valid = validateConfig(next);
      text = `${JSON.stringify(next, null, 2)}\n`;
      out.textContent = text;
      const list = badgeList(valid);
      codes.replaceChildren(h('span', { class: 'label' }, t.badgeCodes), h('p', { class: 'hj' }, list.length ? t.badgeCodesHelp : t.badgeCodesNone),
        ...list.map((b) => {
          const code = badgeCode(home(), b);
          const name = b.repo ? t.figRepoDownloads(b.repo.split('/').pop()) : t[badgeLabels[b.id]];
          return h('div', { class: 'mimir-badge' }, h('strong', {}, name), copyField(code.markdown, 'Markdown'), copyField(code.html, 'HTML'));
        }));
    } catch (e) {
      text = '';
      out.textContent = `${t.invalid} ${e.message.replace(/^mimir\.json: /, '')}`;
      codes.replaceChildren();
    }
    const copy = dialog?.knap('copy');
    if (copy) { copy.disabled = !text; copy.querySelector('span').textContent = t.copy; }
  }
  repos.addEventListener('input', update);
  const link = ui.source.repository ? h('a', { href: `https://github.com/${ui.source.repository}/edit/${ui.source.branch}/mimir.json`, target: '_blank', rel: 'noopener noreferrer', 'data-t': 'openOnGitHub' }) : null;
  const body = h('div', { class: 'mimir-indst' }, reposField, vis.rod, h('div', {}, h('span', { class: 'label', 'data-t': 'publicTotals' }), badges.map((b) => b.box.rod)), warnWell, warn, h('div', {}, h('span', { class: 'label', 'data-t': 'newFile' }), out), link, codes);
  dialog = Kit.dialog({
    t: 'settings', p: { t: 'settingsIntro' }, indhold: body, luk: { ariaT: 'close' },
    knapper: [
      { id: 'close', t: 'close' },
      { id: 'copy', t: 'copy', variant: 'primary', ved: () => {
        navigator.clipboard?.writeText(text).then(() => { dialog.knap('copy').querySelector('span').textContent = t.copied; }, () => {
          const range = document.createRange(); range.selectNodeContents(out); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
        });
        return false;
      } },
    ],
    vedLuk: () => dialog.rod.remove(),
  });
  Sprog.anvend(dialog.rod);
  update();
  dialog.aabn();
}

// "Fetch again": reads the stored figures once more and says what came of it.
// It cannot start a collection; that happens on GitHub, twice a day.
async function refetch() {
  const before = ui.state?.health?.last_run ?? null;
  await start();
  if (!ui.state || ui.error) return;
  const t = L();
  const after = ui.state.health?.last_run ?? null;
  const age = summarize(ui.state, { days: ui.days }).health.ageHours;
  ui.notice = after && after !== before
    ? { variant: 'ok', text: t.fetchNew(t.hoursAgo(age)) }
    : { variant: 'info', text: after ? t.fetchSame(t.hoursAgo(age)) : t.fetchNone };
  draw();
}

// ---------- start ----------
async function start() {
  ui.error = null;
  if (!ui.state && !ui.envelope) draw();
  try {
    ui.source = await locate();
    ui.workflow = undefined;
    if (ui.source.mode === 'pages' && ui.source.demo) {
      const demo = demoSource();
      ui.config = demo.config;
      ui.public = demo.public;
      ui.envelope = null;
      ui.front = Boolean(ui.source.front) && !ui.entered;
      ui.held = ui.front ? demo.state : null;
      ui.state = ui.front ? null : demo.state;
      draw();
      return;
    }
    const file = await loadStateFile(ui.source);
    try { ui.config = validateConfig(await getJson(ui.source.configUrl)); } catch { ui.config = null; }
    try { ui.public = await getJson(ui.source.publicUrl); } catch { ui.public = null; }
    ui.can = await abilities();
    ui.device = await remembered();
    if (isEnvelope(file)) {
      ui.envelope = file;
      if (ui.state && ui.pass) {
        try { ui.state = await openEnvelope(file, ui.pass); } catch { ui.state = null; ui.pass = null; }
      } else {
        ui.state = null;
        // A device that remembers without a check goes straight in, unless it was just locked.
        if (ui.device === 'plain' && !ui.locked) {
          const problem = await openRemembered();
          if (problem) ui.notice = { variant: 'warn', key: problem };
        }
        // Visitors on GitHub Pages meet the front page; a device that remembers meets its own way in.
        ui.front = Boolean(ui.source.front) && !ui.device && !ui.state && !ui.locked;
      }
    } else {
      ui.envelope = null;
      ui.state = file;
    }
  } catch (e) {
    ui.error = e;
  }
  draw();
}
narrow.addEventListener('change', draw);
still.addEventListener('change', draw);
window.addEventListener('hashchange', () => { draw(); shell.flade.scrollTop = 0; });
start();
