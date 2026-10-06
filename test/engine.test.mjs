import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalUrl, safeUrl, parseDisplayedDate, classify, deduplicate, csvEscape, exportCsv } from '../dist/lib/engine.js';
import { createExampleRun } from '../dist/lib/fixtures.js';
const now = new Date('2026-10-06T12:00:00Z');
const candidate = (overrides = {}) => ({ id: 'p1', title: 'Designer for Acme launch', company: 'Acme', url: 'https://acme.example/jobs/launch', location: 'Remote', corroboration: 'not-run', evidence: [{ id: 'e1', kind: 'discovery', title: 'Designer for Acme launch', snippet: 'Paid freelance contract project. Budget $2,000. Remote.', displayedDate: '2 days ago' }], ...overrides });
test('canonical URL removes trackers and fragments, retaining meaningful parameters', () => {
  assert.equal(canonicalUrl('https://WWW.Example.com/a/?utm_source=mail&job=12#reply'), 'https://example.com/a?job=12');
  assert.notEqual(canonicalUrl('https://example.com/a?job=12'), canonicalUrl('https://example.com/a?job=13'));
});
test('unsafe URL protocols and embedded credentials are rejected', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'file:///etc/passwd', 'https://user:password@example.com']) assert.equal(safeUrl(url), '');
});
test('displayed relative dates are interpreted, never confused with captured dates', () => {
  assert.equal(parseDisplayedDate('2 days ago', now).ageDays, 2);
  assert.equal(parseDisplayedDate('30+ days ago', now).ageDays, 30);
  assert.equal(parseDisplayedDate('yesterday', now).ageDays, 1);
  assert.equal(parseDisplayedDate('', now).ageDays, null);
  assert.equal(parseDisplayedDate('May 5', now).ageDays, null);
  assert.equal(parseDisplayedDate('2038-04-01', now).ageDays, null);
});
test('a fresh search capture with no displayed date does not prove freshness', () => {
  const c = candidate(); c.evidence[0].displayedDate = ''; c.evidence[0].capturedAt = now.toISOString(); c.evidence[0].providerCreatedAt = now.toISOString();
  const out = classify(c, { remote: true }, now);
  assert.equal(out.bucket, 'verify'); assert.equal(out.ageDays, null);
  assert.ok(out.reasons.some(r => r.label === 'Freshness unconfirmed'));
});
test('positive evidence produces a promising signal, not verified status', () => {
  const out = classify(candidate(), { remote: true }, now);
  assert.equal(out.bucket, 'promising'); assert.equal(out.score, 85);
  assert.match(out.reasons.find(r => r.label === 'Recent displayed date').detail, /not the original publication/);
  assert.match(out.nextStep, /confirm availability/);
});
test('fresh replies cannot override matching closure evidence', () => {
  const c = candidate(); c.evidence.push({ id: 'e2', kind: 'corroboration', title: c.title, snippet: 'The position is filled. New replies remain visible.', displayedDate: '1 hour ago' });
  const out = classify(c, { remote: true }, now);
  assert.equal(out.bucket, 'caution'); assert.ok(out.reasons.some(r => r.label === 'Closure language found'));
});
test('evergreen roster is cautioned even with recent dates and paid language', () => {
  const c = candidate(); c.evidence[0].snippet += ' Join our talent pool for future opportunities.';
  assert.equal(classify(c, { remote: true }, now).bucket, 'caution');
});
test('remote restrictions are surfaced', () => {
  const c = candidate(); c.evidence[0].snippet += ' US only. Must reside in the United States.';
  const out = classify(c, { remote: true }, now);
  assert.equal(out.bucket, 'caution'); assert.ok(out.reasons.some(r => r.label === 'Location restriction'));
});
test('unpaid text is not promoted as payment', () => {
  const c = candidate(); c.evidence[0].snippet = 'Unpaid freelance project. Remote.';
  assert.equal(classify(c, { remote: true }, now).bucket, 'verify');
});
test('generic jobs pages cannot be classified as promising', () => {
  const c = candidate({ title: 'Freelance Product Designer Jobs' });
  const out = classify(c, { remote: true }, now); assert.equal(out.bucket, 'verify'); assert.ok(out.reasons.some(r => r.label === 'Broad listing page'));
});
test('URL deduplication preserves both source excerpts', () => {
  const a = candidate(), b = candidate({ url: 'https://acme.example/jobs/launch?utm_source=feed', evidence: [{ id: 'e2', kind: 'discovery', snippet: 'Second source excerpt' }] });
  const out = deduplicate([a, b]); assert.equal(out.merged, 1); assert.equal(out.candidates.length, 1); assert.equal(out.candidates[0].evidence.length, 2); assert.equal(a.evidence.length, 1);
});
test('CSV export neutralizes spreadsheet formulas including whitespace prefixes', () => {
  for (const cell of ['=1+1', '+cmd', '-cmd', '@SUM(1)', '\t=1+1', '\r\n@A1']) assert.match(csvEscape(cell), /^"'/);
  assert.equal(csvEscape('a,"b"'), '"a,""b"""');
});
test('CSV keeps per-item provenance when exporting a mixed shortlist', () => {
  const run = createExampleRun(); const a = { ...run.candidates[0], synthetic: false, savedMode: 'recorded', savedCapturedAt: '2020-01-01T00:00:00Z' };
  const csv = exportCsv([a, run.candidates[1]], 'live', now.toISOString());
  assert.match(csv, /"recorded","2020-01-01T00:00:00Z"/); assert.match(csv, /"example"/);
});
test('example fixture honestly covers all lanes and no real requests', () => {
  const run = createExampleRun(); assert.equal(run.candidates.length, 7); assert.equal(run.stats.merged, 1); assert.equal(run.stats.requestsUsed, 0);
  assert.deepEqual(Object.fromEntries(['promising', 'verify', 'caution'].map(k => [k, run.candidates.filter(c => c.bucket === k).length])), { promising: 2, verify: 2, caution: 3 });
  assert.ok(run.candidates.every(c => c.synthetic)); assert.match(run.disclosure, /Fictional/);
});
test('30+ days is a lower bound, never a recent positive signal', () => {
  const c = candidate(); c.evidence[0].displayedDate = '30+ days ago';
  const parsed = parseDisplayedDate(c.evidence[0].displayedDate, now); assert.equal(parsed.isLowerBound, true); assert.equal(parsed.date, null);
  const result = classify(c, { remote: true }, now); assert.equal(result.bucket, 'verify'); assert.equal(result.score, 65);
  assert.ok(!result.reasons.some(r => r.label === 'Recent displayed date')); assert.match(result.reasons.find(r => r.label === 'Freshness unconfirmed').detail, /lower bound/);
});
