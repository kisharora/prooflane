import { canonicalUrl, cleanText, safeUrl, stableId } from '../dist/lib/engine.js';
const CACHE_TTL = 15 * 60 * 1000;
const MAX_CACHE = 120;
export class ResearchError extends Error {
  constructor(code, message, status = 502) { super(message); this.code = code; this.status = status; }
}
export class SerpApiClient {
  constructor({ apiKey, fetchImpl = fetch, now = () => Date.now(), hourlyLimit = 24, timeoutMs = 12000, usage = { calls: [] } } = {}) {
    this.apiKey = apiKey; this.fetchImpl = fetchImpl; this.now = now; this.hourlyLimit = hourlyLimit; this.timeoutMs = timeoutMs;
    this.cache = new Map(); this.usage = usage; this.inflight = new Map();
  }
  remaining() { this.usage.calls = this.usage.calls.filter(t => t > this.now() - 3600000); return Math.max(0, this.hourlyLimit - this.usage.calls.length); }
  async search(params, { signal } = {}) {
    if (!this.apiKey) throw new ResearchError('KEY_MISSING', 'Live search needs a SerpApi key in the server environment. The example workspace is still available.', 503);
    const allowed = { engine: params.engine, q: params.q, hl: 'en', output: 'json', ...(params.gl ? { gl: params.gl } : {}), ...(params.tbs ? { tbs: params.tbs } : {}) };
    if (!['google', 'google_jobs'].includes(allowed.engine)) throw new ResearchError('INVALID_ENGINE', 'Unsupported search engine.', 400);
    const key = JSON.stringify(allowed);
    const cached = this.cache.get(key);
    if (cached && this.now() - cached.at < CACHE_TTL) return { data: structuredClone(cached.data), cacheHit: true, outbound: false };
    if (this.inflight.has(key)) return { ...(await this.inflight.get(key)), cacheHit: true, outbound: false };
    if (this.remaining() === 0) throw new ResearchError('RATE_LIMIT', 'This server’s hourly request cap has been reached. Try again later or explore the example workspace.', 429);
    this.usage.calls.push(this.now());
    const task = this.fetchSearch(allowed, signal);
    this.inflight.set(key, task);
    try {
      const result = await task;
      this.cache.set(key, { data: result.data, at: this.now() });
      while (this.cache.size > MAX_CACHE) this.cache.delete(this.cache.keys().next().value);
      return result;
    } finally { this.inflight.delete(key); }
  }
  async fetchSearch(params, externalSignal) {
    const url = new URL('https://serpapi.com/search.json');
    for (const [k, v] of Object.entries({ ...params, api_key: this.apiKey })) url.searchParams.set(k, v);
    const signal = externalSignal ? AbortSignal.any([externalSignal, AbortSignal.timeout(this.timeoutMs)]) : AbortSignal.timeout(this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, { signal, headers: { Accept: 'application/json' }, redirect: 'error' });
      if ([401, 403].includes(response.status)) throw new ResearchError('PROVIDER_AUTH', 'SerpApi did not accept the server’s key. Check the key in your local environment.', 502);
      if (response.status === 429) throw new ResearchError('PROVIDER_LIMIT', 'SerpApi’s rate or credit limit was reached. No automatic retries were made.', 429);
      if (!response.ok) throw new ResearchError('PROVIDER_UNAVAILABLE', 'SerpApi is temporarily unavailable. No automatic retries were made. Please try again later.', 502);
      const data = await response.json();
      if (!data || typeof data !== 'object') throw new ResearchError('BAD_RESPONSE', 'The search provider returned an unexpected response.');
      if (data.error || data.search_metadata?.status === 'Error') throw new ResearchError('PROVIDER_SEARCH_ERROR', 'The search provider could not complete this query. Try a simpler skill or a different location.');
      if (data.search_metadata?.status === 'Processing') throw new ResearchError('PROVIDER_PROCESSING', 'The search provider has not completed this query yet. Try again later.');
      // Only retain fields we use. Never expose search_parameters, API URLs, or raw provider errors.
      return { data: sanitizeProviderData(data, params), cacheHit: false, outbound: true };
    } catch (e) {
      if (e instanceof ResearchError) throw e;
      if (signal.aborted || ['AbortError', 'TimeoutError'].includes(e?.name)) throw new ResearchError('TIMEOUT', 'The search timed out. Completed results are kept; no automatic retries were made.', 504);
      throw new ResearchError('NETWORK_ERROR', 'Could not reach SerpApi. Check your server’s network connection and try again.', 502);
    }
  }
}
export function sanitizeProviderData(data, params) {
  const organic = Array.isArray(data.organic_results) ? data.organic_results.slice(0, 20).map(r => ({ title: cleanText(r.title, 250), link: safeUrl(r.link), snippet: cleanText(r.snippet, 1500), date: cleanText(r.date, 100), source: cleanText(r.source, 120) })).filter(r => r.title && r.link) : [];
  const jobs = Array.isArray(data.jobs_results) ? data.jobs_results.slice(0, 20).map(r => ({ title: cleanText(r.title, 250), company_name: cleanText(r.company_name, 150), location: cleanText(r.location, 150), description: cleanText(r.description, 3500), posted_at: cleanText(r.detected_extensions?.posted_at, 100), schedule_type: cleanText(r.detected_extensions?.schedule_type, 100), salary: cleanText(r.detected_extensions?.salary, 100), via: cleanText(r.via, 100), share_link: safeUrl(r.share_link), apply_options: (Array.isArray(r.apply_options) ? r.apply_options : []).slice(0, 5).map(a => ({ title: cleanText(a.title, 120), link: safeUrl(a.link) })).filter(a => a.link) })).filter(r => r.title) : [];
  return { organic_results: organic, jobs_results: jobs, providerSearchId: cleanText(data.search_metadata?.id, 100), providerCreatedAt: cleanText(data.search_metadata?.created_at, 100), engine: params.engine };
}
export function normalizeResults(data, query, capturedAt, source = 'discovery') {
  const out = [];
  for (const r of data.organic_results || []) {
    const url = canonicalUrl(r.link); if (!url) continue;
    const id = stableId(url), host = new URL(url).hostname;
    out.push({ id, title: r.title, company: r.source || host, location: '', url, corroboration: 'not-run', evidence: [{ id: `${id}-${source}-${stableId(query)}`, kind: source, title: r.title, snippet: r.snippet, displayedDate: r.date, source: 'Google web · SerpApi', url, query, capturedAt, providerCreatedAt: data.providerCreatedAt, providerSearchId: data.providerSearchId }] });
  }
  for (const r of data.jobs_results || []) {
    const url = canonicalUrl(r.apply_options?.[0]?.link || r.share_link); if (!url) continue;
    const id = stableId(url);
    out.push({ id, title: r.title, company: r.company_name || new URL(url).hostname, location: r.location, url, corroboration: 'not-run', evidence: [{ id: `${id}-${source}-${stableId(query)}`, kind: source, title: r.title, snippet: [r.description, r.schedule_type, r.salary].filter(Boolean).join(' · '), displayedDate: r.posted_at, location: r.location, source: 'Google Jobs · SerpApi', url, query, capturedAt, providerCreatedAt: data.providerCreatedAt, providerSearchId: data.providerSearchId }] });
  }
  return out;
}
const STOPWORDS = new Set(['the','and','for','with','from','your','this','that','our','job','jobs','hiring','remote','freelance','contract','designer','developer','engineer','looking','needed','paid','role','work','position','full','time','part']);
function titleTokens(title) { return [...new Set(title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(' ').filter(w => w.length > 2 && !STOPWORDS.has(w)))]; }
/** Conservative entity matching prevents an unrelated "filled" result poisoning a candidate. */
export function matchesCandidate(candidate, result) {
  const target = canonicalUrl(candidate.url), incoming = canonicalUrl(result.url);
  if (!target || !incoming) return false;
  if (target === incoming) return true;
  const a = new URL(target), b = new URL(incoming);
  // For forums and listing platforms, same domain is far too weak. Require exact path.
  if (a.hostname !== b.hostname) return false;
  if (/reddit|community\.|forum|linkedin|indeed|glassdoor|upwork|freelancer|google\./i.test(a.hostname)) return false;
  const tokens = titleTokens(candidate.title), resultTokens = new Set(titleTokens(result.title));
  if (tokens.length < 3) return false;
  const overlap = tokens.filter(t => resultTokens.has(t)).length / tokens.length;
  return overlap >= .85 && tokens.filter(t => resultTokens.has(t)).length >= 3;
}
