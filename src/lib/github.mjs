// Minimal GitHub REST client: no dependencies, bounded retries, never logs the token.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function ghGet(path, { token, api = 'https://api.github.com', fetchImpl = fetch, retries = 3, backoffMs = 1000 } = {}) {
  const url = path.startsWith('http') ? path : `${api}${path}`;
  const headers = { accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'wi24rd-mimir' };
  if (token) headers.authorization = `Bearer ${token}`;
  let last = { ok: false, status: 0, error: 'not attempted' };
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(backoffMs * 2 ** (attempt - 1));
    let res;
    try {
      res = await fetchImpl(url, { headers, signal: AbortSignal.timeout(20000) });
    } catch (e) {
      last = { ok: false, status: 0, error: `network: ${e.name}` };
      continue;
    }
    if (res.ok) {
      try { return { ok: true, status: res.status, data: await res.json(), link: res.headers.get('link') }; }
      catch { last = { ok: false, status: res.status, error: 'invalid JSON in response' }; continue; }
    }
    let message = '';
    try { message = String((await res.json()).message ?? '').slice(0, 200); } catch { /* body is optional */ }
    last = { ok: false, status: res.status, error: message || `HTTP ${res.status}` };
    const retryable = res.status >= 500 || res.status === 429;
    if (!retryable) break;
  }
  return last;
}

// Follows rel="next" for list endpoints, with a hard page limit.
export async function ghGetAll(path, opts = {}, maxPages = 10) {
  const sep = path.includes('?') ? '&' : '?';
  let next = `${path}${sep}per_page=100`;
  const items = [];
  for (let page = 0; next && page < maxPages; page++) {
    const r = await ghGet(next, opts);
    if (!r.ok) return r;
    if (!Array.isArray(r.data)) return { ok: false, status: r.status, error: 'expected a list' };
    items.push(...r.data);
    next = /<([^>]+)>;\s*rel="next"/.exec(r.link ?? '')?.[1] ?? null;
  }
  return { ok: true, status: 200, data: items };
}
