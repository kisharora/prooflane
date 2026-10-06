import { cleanText, classify, deduplicate } from '../dist/lib/engine.js';
import { ResearchError, normalizeResults, matchesCandidate } from './serpapi.mjs';
export function validateInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ResearchError('BAD_INPUT', 'Provide a skill, location, and request budget.', 400);
  const skill = cleanText(body.skill, 100), location = cleanText(body.location || 'Anywhere', 100);
  if (skill.length < 2) throw new ResearchError('BAD_INPUT', 'Enter at least two characters for your skill or service.', 400);
  if (![3, 5, 8].includes(Number(body.budget))) throw new ResearchError('BAD_BUDGET', 'Choose a request budget of 3, 5, or 8.', 400);
  return { skill, location, remote: body.remote === true, budget: Number(body.budget) };
}
function queryWords(text) { return text.replace(/["\\<>\n\r]/g, ' ').replace(/\s+/g, ' ').trim(); }
export function discoveryPlan(input) {
  const skill = queryWords(input.skill), place = input.location.toLowerCase() === 'anywhere' ? '' : queryWords(input.location);
  return [
    { engine: 'google', stage: 'discovery', q: `${skill} (freelance OR contract OR project) ${input.remote ? 'remote' : ''} ${place} (paid OR budget OR hiring)`.replace(/\s+/g, ' ').trim(), tbs: 'qdr:m' },
    { engine: 'google_jobs', stage: 'discovery', q: `${skill} freelance contract ${input.remote ? 'remote' : ''} ${place}`.replace(/\s+/g, ' ').trim() },
  ];
}
export function corroborationQuery(candidate) {
  const host = new URL(candidate.url).hostname;
  const title = queryWords(candidate.title).slice(0, 160);
  return `site:${host} "${title}" (closed OR filled OR accepting OR hiring OR paused)`;
}
export async function research(body, client, { now = () => new Date(), signal } = {}) {
  const input = validateInput(body), started = now(), capturedAt = started.toISOString();
  const queries = [], warnings = [];
  let requestsUsed = 0, cacheHits = 0, raw = [], matched = 0;
  const deadline = AbortSignal.timeout(55000);
  const runSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
  async function execute(item) {
    const record = { engine: item.engine, stage: item.stage, query: item.q, status: 'pending', resultCount: 0 };
    queries.push(record);
    try {
      const response = await client.search(item, { signal: runSignal });
      if (response.cacheHit) cacheHits++; else requestsUsed++;
      const results = normalizeResults(response.data, item.q, capturedAt, item.stage === 'discovery' ? 'discovery' : 'corroboration');
      record.status = response.cacheHit ? 'cached' : 'complete'; record.resultCount = results.length;
      record.providerSearchId = response.data.providerSearchId; record.providerCreatedAt = response.data.providerCreatedAt;
      return { results, record };
    } catch (e) {
      // Count attempted provider calls even when an error is returned, except preflight rejections.
      if (!['KEY_MISSING', 'RATE_LIMIT'].includes(e.code)) requestsUsed++;
      record.status = 'error'; record.errorCode = e.code || 'SEARCH_ERROR';
      const message = e instanceof ResearchError ? e.message : 'A search could not be completed.';
      warnings.push(message);
      return { results: [], record };
    }
  }
  const discovery = await Promise.all(discoveryPlan(input).map(execute));
  raw = discovery.flatMap(part => part.results);
  const deduped = deduplicate(raw);
  let candidates = deduped.candidates.map(c => classify(c, input, started)).sort((a, b) => b.score - a.score);
  // Prioritize candidates that seem promising: bad evidence here costs users the most time.
  const targets = candidates.slice(0, input.budget - 2);
  for (let i = 0; i < targets.length; i += 2) {
    if (runSignal.aborted) { warnings.push('The run reached its time limit. Remaining candidates were not checked.'); break; }
    await Promise.all(targets.slice(i, i + 2).map(async candidate => {
      const { results, record } = await execute({ engine: 'google', stage: 'corroboration', q: corroborationQuery(candidate) });
      const evidence = results.filter(r => matchesCandidate(candidate, r)).flatMap(r => r.evidence);
      candidate.corroboration = evidence.length ? 'matched' : record.status === 'error' ? 'error' : 'no-match';
      if (evidence.length) { candidate.evidence.push(...evidence.slice(0, 3)); matched++; }
    }));
  }
  candidates = candidates.map(c => classify(c, input, started)).sort((a, b) => b.score - a.score);
  return { mode: 'live', status: discovery.every(part => part.record.status === 'error') ? 'failed' : warnings.length ? 'partial' : 'complete', capturedAt, input, candidates, stats: { requestsUsed, requestBudget: input.budget, cacheHits, merged: deduped.merged, discovered: raw.length, verified: matched, durationMs: now() - started }, queries, warnings: [...new Set(warnings)], disclosure: 'Live search excerpts from SerpApi. Signal scores are deterministic heuristics, not probabilities or verification of an opening. Provider-displayed dates may reflect updates. Confirm details at the original source.' };
}
