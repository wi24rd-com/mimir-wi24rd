// The shape of the stored figures. Schema 1. Shared by the collector, which
// fills it, and the demo, which invents it.

export const SCHEMA = 1;

export function emptyState() {
  return { schema: SCHEMA, repos: {}, health: { last_run: null, runs: 0, last_errors: [] } };
}

export function emptyRepo() {
  return { views: {}, clones: {}, referrers: {}, paths: {}, downloads: {}, meta: {}, last_success: {} };
}
