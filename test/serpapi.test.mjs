import test from 'node:test';
import assert from 'node:assert/strict';
import { SerpApiClient, normalizeResults, matchesCandidate, sanitizeProviderData } from '../lib/serpapi.mjs';
import { research, validateInput, discoveryPlan } from '../lib/research.mjs';
const DUMMY_KEY = 'dummy-key-for-tests-not-a-credential';
const json = data => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
const organic = { search_metadata: { status: 'Success', id: 'test-search', created_at: '2026-10-06 00:00:00 UTC' }, search_parameters: { api_key: DUMMY_KEY }, organic_results: [{ title: 'Analytics launch design project', link: 'https://acme.example/projects/design', snippet: 'Paid freelance project, $2000. Remote.', date: '2 days ago' }] };
test('real adapter uses documented SerpApi endpoint and server key only', async () => {
  let called; const client = new SerpApiClient({ apiKey: DUMMY_KEY, fetchImpl: async (url, options) => { called = url; assert.equal(options.redirect, 'error'); return json(organic); } });
  const result = await client.search({ engine: 'google', q: 'design', tbs: 'qdr:m' });
  assert.equal(called.origin, 'https://serpapi.com'); assert.equal(called.pathname, '/search.json'); assert.equal(called.searchParams.get('api_key'), DUMMY_KEY);
  assert.equal(called.searchParams.get('engine'), 'google'); assert.equal(called.searchParams.get('tbs'), 'qdr:m');
  assert.ok(!JSON.stringify(result).includes(DUMMY_KEY)); assert.ok(!result.data.search_parameters);
});
test('provider errors do not leak the key or raw error body', async () => {
  const client = new SerpApiClient({ apiKey: DUMMY_KEY, fetchImpl: async () => json({ error: `Invalid key ${DUMMY_KEY}` }) });
  await assert.rejects(() => client.search({ engine: 'google', q: 'design' }), error => error.code === 'PROVIDER_SEARCH_ERROR' && !error.message.includes(DUMMY_KEY));
});
test('network exceptions are sanitized', async () => {
  const client = new SerpApiClient({ apiKey: DUMMY_KEY, fetchImpl: async () => { throw new Error(`failed https://serpapi.com?api_key=${DUMMY_KEY}`); } });
  await assert.rejects(() => client.search({ engine: 'google', q: 'design' }), e => e.code === 'NETWORK_ERROR' && !e.message.includes(DUMMY_KEY));
});
test('cache avoids additional outbound requests and preserves result isolation', async () => {
  let count = 0; const client = new SerpApiClient({ apiKey: DUMMY_KEY, fetchImpl: async () => { count++; return json(organic); } });
  const first = await client.search({ engine: 'google', q: 'design' }); const second = await client.search({ engine: 'google', q: 'design' });
  assert.equal(count, 1); assert.equal(first.cacheHit, false); assert.equal(second.cacheHit, true);
  second.data.organic_results[0].title = 'changed'; assert.notEqual((await client.search({ engine: 'google', q: 'design' })).data.organic_results[0].title, 'changed');
});
test('cache expires after 15 minutes', async () => {
  let time = 0, calls = 0; const client = new SerpApiClient({ apiKey: DUMMY_KEY, now: () => time, fetchImpl: async () => { calls++; return json(organic); } });
  await client.search({ engine: 'google', q: 'design' }); time += 15 * 60000 + 1; await client.search({ engine: 'google', q: 'design' }); assert.equal(calls, 2);
});
test('concurrent identical queries share one provider call', async () => {
  let count = 0; const client = new SerpApiClient({ apiKey: DUMMY_KEY, fetchImpl: async () => { count++; await new Promise(r => setTimeout(r, 10)); return json(organic); } });
  const results = await Promise.all([client.search({ engine: 'google', q: 'design' }), client.search({ engine: 'google', q: 'design' })]);
  assert.equal(count, 1); assert.equal(results.filter(r => r.outbound).length, 1);
});
test('hourly cap applies to actual outbound attempts', async () => {
  let count = 0; const client = new SerpApiClient({ apiKey: DUMMY_KEY, hourlyLimit: 1, fetchImpl: async () => { count++; return json(organic); } });
  await client.search({ engine: 'google', q: 'one' }); await client.search({ engine: 'google', q: 'one' });
  await assert.rejects(() => client.search({ engine: 'google', q: 'two' }), e => e.code === 'RATE_LIMIT'); assert.equal(count, 1);
});
test('timeout is bounded and produces an actionable sanitized error', async () => {
  const client = new SerpApiClient({ apiKey: DUMMY_KEY, timeoutMs: 5, fetchImpl: async (url, { signal }) => new Promise((resolve, reject) => { signal.addEventListener('abort', () => reject(signal.reason), { once: true }); setTimeout(() => resolve(json(organic)), 20); }) });
  await assert.rejects(() => client.search({ engine: 'google', q: 'slow' }), e => e.code === 'TIMEOUT');
});
test('Google Jobs responses normalize documented apply_options and detected_extensions', () => {
  const data = sanitizeProviderData({ jobs_results: [{ title: 'Product designer', company_name: 'Example', location: 'Remote', description: 'Paid contract', detected_extensions: { posted_at: '1 day ago', salary: '$60/hr' }, apply_options: [{ title: 'Employer', link: 'https://example.com/job' }] }] }, { engine: 'google_jobs' });
  const out = normalizeResults(data, 'query', '2026-10-06T00:00:00Z'); assert.equal(out.length, 1); assert.equal(out[0].url, 'https://example.com/job'); assert.equal(out[0].evidence[0].displayedDate, '1 day ago'); assert.match(out[0].evidence[0].snippet, /\$60\/hr/);
});
test('URL match ignores tracking; unrelated closure results are rejected', () => {
  const c = { title: 'Analytics launch design project', url: 'https://acme.example/projects/analytics' };
  assert.equal(matchesCandidate(c, { title: 'Position filled', url: `${c.url}?utm_source=feed` }), true);
  assert.equal(matchesCandidate(c, { title: 'Position filled: marketing associate', url: 'https://acme.example/jobs/marketing' }), false);
  assert.equal(matchesCandidate(c, { title: c.title, url: 'https://different.example/projects/analytics' }), false);
});
test('forum matching rejects identical generic titles from a different thread', () => {
  const c = { title: 'Hiring freelance product designer', url: 'https://community.example/t/design/100' };
  assert.equal(matchesCandidate(c, { title: c.title, url: 'https://community.example/t/design/101' }), false);
});
test('title corroboration requires enough distinctive tokens on the same domain', () => {
  assert.equal(matchesCandidate({ title: 'Freelance product designer', url: 'https://acme.example/a' }, { title: 'Freelance product designer filled', url: 'https://acme.example/b' }), false);
  assert.equal(matchesCandidate({ title: 'Analytics onboarding launch specialist', url: 'https://acme.example/a' }, { title: 'Analytics onboarding launch specialist applications closed', url: 'https://acme.example/b' }), true);
});
test('input validation rejects arbitrary budgets and sanitizes query length', () => {
  for (const budget of [0, 4, 9, 100, 'bad']) assert.throws(() => validateInput({ skill: 'Design', budget }));
  assert.throws(() => validateInput({ skill: 'x', budget: 3 })); assert.equal(validateInput({ skill: 'x'.repeat(500), budget: 3 }).skill.length, 100);
  assert.equal(discoveryPlan(validateInput({ skill: 'Design', budget: 5, remote: true })).length, 2);
});
test('research hard budget covers discovery and follow-up requests', async () => {
  let calls = 0;
  const client = new SerpApiClient({ apiKey: DUMMY_KEY, fetchImpl: async url => { calls++; const q = url.searchParams.get('q'); return json(q.startsWith('site:') ? { organic_results: [] } : { organic_results: Array.from({ length: 12 }, (_, i) => ({ title: `Analytics onboarding launch ${i}`, link: `https://example.com/job-${i}`, snippet: 'Paid freelance project remote $2000', date: '1 day ago' })) }); } });
  const out = await research({ skill: 'Design', location: 'Anywhere', remote: true, budget: 5 }, client, { now: () => new Date('2026-10-06') });
  assert.equal(calls, 5); assert.equal(out.stats.requestsUsed, 5); assert.equal(out.queries.length, 5); assert.equal(out.stats.merged, 12);
});
test('a failed engine still yields honest partial results', async () => {
  const client = new SerpApiClient({ apiKey: DUMMY_KEY, fetchImpl: async url => url.searchParams.get('engine') === 'google_jobs' ? new Response('', { status: 500 }) : json(organic) });
  const out = await research({ skill: 'Design', budget: 3, remote: true }, client, { now: () => new Date('2026-10-06') });
  assert.equal(out.candidates.length, 1); assert.equal(out.warnings.length, 1); assert.ok(out.queries.some(q => q.status === 'error')); assert.equal(out.mode, 'live');
});
test('unrelated closure follow-up cannot move a real candidate into caution', async () => {
  const client = new SerpApiClient({ apiKey: DUMMY_KEY, fetchImpl: async url => json(url.searchParams.get('q').startsWith('site:') ? { organic_results: [{ title: 'Marketing manager', link: 'https://acme.example/marketing', snippet: 'The position is filled.' }] } : organic) });
  const out = await research({ skill: 'Design', budget: 3, remote: true }, client, { now: () => new Date('2026-10-06') });
  assert.equal(out.candidates[0].bucket, 'promising'); assert.equal(out.candidates[0].corroboration, 'no-match'); assert.equal(out.candidates[0].evidence.length, 2);
});
test('platform job IDs in query parameters are distinct candidate identities', () => {
  assert.equal(matchesCandidate({ title: 'Freelance web designer', url: 'https://www.indeed.com/viewjob?jk=alpha' }, { title: 'Marketing manager', url: 'https://www.indeed.com/viewjob?jk=beta' }), false);
  assert.equal(matchesCandidate({ title: 'Freelance web designer', url: 'https://www.indeed.com/viewjob?jk=alpha' }, { title: 'Position filled', url: 'https://www.indeed.com/viewjob?jk=alpha&utm_source=feed' }), true);
});
test('total discovery failure is distinguished from a genuine empty result set', async () => {
  const failure = new SerpApiClient({ apiKey: DUMMY_KEY, fetchImpl: async () => new Response('', { status: 401 }) });
  const failed = await research({ skill: 'Design', budget: 3 }, failure); assert.equal(failed.status, 'failed'); assert.equal(failed.candidates.length, 0); assert.equal(failed.queries.length, 2); assert.equal(failed.warnings.length, 1);
  const empty = new SerpApiClient({ apiKey: DUMMY_KEY, fetchImpl: async () => json({ search_metadata: { status: 'Success' }, organic_results: [] }) });
  const completed = await research({ skill: 'Design', budget: 3 }, empty); assert.equal(completed.status, 'complete'); assert.equal(completed.candidates.length, 0); assert.equal(completed.warnings.length, 0);
});
