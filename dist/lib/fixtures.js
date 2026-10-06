import { classify, deduplicate, stableId } from './engine.js';
export const EXAMPLE_CAPTURED_AT = '2026-10-06T05:30:00.000Z';
const rows = [
  ['atlas', 'Atlas Studio', 'Landing page designer for a product launch', 'Paid freelance project: design and build a landing page over 3 weeks. Budget $2,400. Remote, flexible time zones. Applications open.', '2 days ago', 'Remote', 'Web search', 'https://atlas.example/projects/launch-designer', 'Still accepting proposals for our landing page designer project. Paid contract, start October 12.', 'matched'],
  ['form', 'Form & Field', 'Freelance product designer · 6-week sprint', 'Seeking a freelance product designer for a six-week onboarding project. Paid contract, $65/hr. Remote collaboration. Portfolio required.', '4 days ago', 'Remote', 'Google Jobs', 'https://formandfield.example/jobs/product-designer', 'Freelance product designer · 6-week sprint. Applications open for the paid onboarding project.', 'matched'],
  ['north', 'Northline Labs', 'Design partner for an early-stage product', 'We are looking for a design partner to shape an analytics product. Remote, project-based collaboration. Send relevant product work.', '3 days ago', 'Remote', 'Web search', 'https://northline.example/design-partner', '', 'not-run'],
  ['morrow', 'Morrow Creative', 'Freelance visual designer for a brand refresh', 'Paid freelance visual designer needed for a brand refresh project. $1,800 fixed fee. Remote. Scope includes a small website and launch assets.', '', 'Remote', 'Web search', 'https://morrow.example/brand-refresh', '', 'not-run'],
  ['orbit', 'Daybreak Digital', 'Paid design trial for a website project', 'Paid design trial for a freelance website project. Remote. $300 trial with potential for a full project. Submit your portfolio.', '1 day ago', 'Remote', 'Web search', 'https://daybreak.example/design-trial', 'Paid test closed. The position is filled. This original thread remains visible after new replies.', 'matched'],
  ['mosaic', 'Mosaic Works', 'Join our freelance design talent network', 'Join our roster of freelance designers. We keep a talent pool for future opportunities. No immediate project is available. Paid work when matched. Remote.', '5 days ago', 'Remote', 'Web search', 'https://mosaicworks.example/talent', '', 'not-run'],
  ['paper', 'Paperplane Co.', 'Contract product designer · remote', 'Paid contract project: product designer, $80/hr. Remote, US only. Must reside in the United States. Six-month engagement.', '6 days ago', 'US only', 'Google Jobs', 'https://paperplane.example/jobs/designer', '', 'not-run'],
  ['atlas-dup', 'Atlas Studio', 'Landing page designer for a product launch', 'Paid freelance landing page project. Budget $2,400. Remote. Three-week engagement.', '2 days ago', 'Remote', 'Web search', 'https://atlas.example/projects/launch-designer?utm_source=board', '', 'not-run'],
];
export function createExampleRun(input = { skill: 'Product design', location: 'Anywhere', remote: true, budget: 5 }) {
  const candidates = rows.map(([key, company, title, snippet, displayedDate, location, source, url, followup, corroboration]) => {
    const id = stableId(url.split('?')[0]);
    const evidence = [{ id: `${id}-d`, kind: 'discovery', title, snippet, displayedDate, location, source, url, capturedAt: EXAMPLE_CAPTURED_AT, query: 'product design (freelance OR contract OR project) remote paid', synthetic: true }];
    if (followup) evidence.push({ id: `${id}-c`, kind: 'corroboration', title, snippet: followup, displayedDate: 'Today', source: 'Targeted status search', url, capturedAt: EXAMPLE_CAPTURED_AT, query: `site:${new URL(url).hostname} "${title}" (closed OR filled OR accepting)`, synthetic: true });
    return { id, title, company, url, location, evidence, corroboration, synthetic: true };
  });
  const result = deduplicate(candidates);
  return { mode: 'example', capturedAt: EXAMPLE_CAPTURED_AT, input: { ...input, skill: 'Product design', location: 'Anywhere', remote: true }, candidates: result.candidates.map(c => classify(c, { remote: true }, new Date(EXAMPLE_CAPTURED_AT))).sort((a, b) => b.score - a.score), stats: { requestsUsed: 0, requestBudget: input.budget, simulatedQueries: 5, cacheHits: 0, merged: result.merged, discovered: candidates.length, verified: 3 }, queries: [
    { engine: 'google', stage: 'discovery', query: 'product design (freelance OR contract OR project) remote paid', status: 'example', resultCount: 6 },
    { engine: 'google_jobs', stage: 'discovery', query: 'product design freelance contract remote', status: 'example', resultCount: 2 },
    { engine: 'google', stage: 'corroboration', query: 'site:atlas.example "Landing page designer" (closed OR filled OR accepting)', status: 'example', resultCount: 1 },
    { engine: 'google', stage: 'corroboration', query: 'site:formandfield.example "Freelance product designer" (closed OR filled OR accepting)', status: 'example', resultCount: 1 },
    { engine: 'google', stage: 'corroboration', query: 'site:daybreak.example "Paid design trial" (closed OR filled OR accepting)', status: 'example', resultCount: 1 },
  ], warnings: [], disclosure: 'Fictional example dataset. Organizations, excerpts, rates, and dates are illustrative. No live searches were made. Source links are intentionally disabled.' };
}
