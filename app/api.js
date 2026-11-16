// make.fun's public API: read-only GET requests, open to any origin (CORS).
// The full API is described at https://make.fun/api/openapi.json.
//
// Every answer is cached in memory for 60 seconds and revalidated with the
// ETag the API sent: within the same minute a revalidation answers 304 and
// costs no download, so revisiting a view is free and a view costs one
// request at most. The cache lives in this module, so the board, a bounty
// page and its leaderboard share one copy of each answer.

const API = 'https://make.fun/api';
const TTL_MS = 60_000;

/** path -> { data, etag, fetchedAt } */
const cache = new Map();

async function get(path) {
  const now = Date.now();
  const hit = cache.get(path);
  const headers = {};
  if (hit && now - hit.fetchedAt < TTL_MS) return hit.data;
  if (hit && hit.etag) headers['If-None-Match'] = hit.etag;

  const res = await fetch(API + path, { headers });
  if (res.status === 304 && hit) {
    hit.fetchedAt = now;
    return hit.data;
  }
  if (!res.ok) {
    const error = new Error(`make.fun answered ${res.status} for ${path}`);
    error.status = res.status;
    throw error;
  }
  const data = await res.json();
  cache.set(path, { data, etag: res.headers.get('etag'), fetchedAt: now });
  return data;
}

/** The listed bounties: { items: [...] } (activity=times leaves out the activity a board does not show). */
export const getBounties = () => get('/competitions?status=open&activity=times');

/** One bounty, by its slug. */
export const getBounty = (slug) => get(`/competitions/${encodeURIComponent(slug)}`);

/** A bounty's leaderboard: { entries: [...], columns, rank_key, ... }. */
export const getLeaderboard = (slug) => get(`/competitions/${encodeURIComponent(slug)}/leaderboard`);

/** An account's public profile, by handle. */
export const getProfile = (handle) => get(`/profiles/${encodeURIComponent(handle)}`);

/** One entry's public detail, by submission id. */
export const getSubmission = (id) => get(`/submissions/${encodeURIComponent(id)}`);
