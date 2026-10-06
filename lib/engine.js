/** Pure, shared rules: same classification in demo, live mode, and tests. */
export const POLICY_VERSION = '1.0.0';
export const BUCKETS = {
  promising: { title: 'Promising signals', subtitle: 'Worth a closer look', color: 'green' },
  verify: { title: 'Needs checking', subtitle: 'A few gaps to close', color: 'amber' },
  caution: { title: 'Caution signals', subtitle: 'Read before you reach out', color: 'rose' },
};
export function cleanText(value, max = 1600) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
}
export function safeUrl(value) {
  try { const u = new URL(value); if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password) return ''; return u.href; } catch { return ''; }
}
export function canonicalUrl(value) {
  const url = safeUrl(value); if (!url) return '';
  const u = new URL(url); u.hash = ''; u.hostname = u.hostname.replace(/^www\./, '').toLowerCase();
  for (const key of [...u.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$|ref$|source$|trk$)/i.test(key)) u.searchParams.delete(key);
  u.searchParams.sort(); u.pathname = u.pathname.replace(/\/+$/, '') || '/';
  return u.href;
}
export function stableId(text) {
  let n = 2166136261; for (const ch of text) { n ^= ch.charCodeAt(0); n = Math.imul(n, 16777619); }
  return 'p' + (n >>> 0).toString(36);
}
export function parseDisplayedDate(value, now = new Date()) {
  const text = cleanText(value, 100).toLowerCase();
  if (!text) return { ageDays: null, date: null };
  let days;
  const relative = text.match(/\b(\d+)\+?\s*(minute|hour|day|week|month|year)s?\s+ago\b/);
  if (relative) days = Number(relative[1]) * ({ minute: 1 / 1440, hour: 1 / 24, day: 1, week: 7, month: 30, year: 365 }[relative[2]]);
  else if (/^(today|just posted|just now)$/.test(text)) days = 0;
  else if (text === 'yesterday') days = 1;
  else if (/\b\d{4}\b/.test(text)) {
    const timestamp = Date.parse(text); if (Number.isFinite(timestamp)) days = (now.getTime() - timestamp) / 86400000;
  }
  if (!Number.isFinite(days) || days < -1) return { ageDays: null, date: null };
  days = Math.max(0, Math.floor(days));
  const isLowerBound = /\d+\+\s*(?:minute|hour|day|week|month|year)s?\s+ago/.test(text);
  return { ageDays: days, date: isLowerBound ? null : new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10), isLowerBound };
}
const CLOSED = /\b(?:applications? (?:are |is |now )?closed|position (?:has been |is |now )?filled|role (?:has been |is |now )?filled|no longer (?:accepting|hiring|available)|hiring (?:is |has been )?(?:paused|closed)|project (?:is |has been )?(?:cancelled|canceled|closed)|paid test (?:is |has been )?closed)\b/i;
const ROSTER = /\b(?:talent (?:pool|network|roster)|evergreen|future opportunities|no (?:current|immediate|active) (?:opening|project|role)|join our (?:roster|network))\b/i;
const PAYMENT = /(?:[$₹€£]\s?\d|\b(?:USD|INR|EUR|GBP)\s?\d|\b(?:paid|budget|compensation|salary|hourly rate|day rate)\b)/i;
const SCOPE = /\b(?:freelance|contract|contractor|project|deliverable|fixed[- ](?:term|price)|part[- ]time|retainer)\b/i;
const REMOTE = /\b(?:remote|work from (?:home|anywhere)|anywhere)\b/i;
const ONSITE = /\b(?:on[- ]site|onsite|office[- ]based|in[- ]office|must (?:be based|reside)|hybrid|US only|U\.S\. only|USA only)\b/i;
function reason(kind, label, detail, evidenceId, weight = 0) { return { kind, label, detail, evidenceId, weight }; }
export function classify(candidate, input, now = new Date()) {
  const discovery = candidate.evidence.filter(e => e.kind === 'discovery');
  const text = discovery.map(e => `${e.title} ${e.snippet} ${e.location || ''}`).join(' ');
  const flags = []; let score = 10;
  const closure = candidate.evidence.find(e => CLOSED.test(`${e.title} ${e.snippet}`) && !/\b(?:not|never) (?:closed|filled)\b/i.test(e.snippet));
  const roster = discovery.find(e => ROSTER.test(`${e.title} ${e.snippet}`));
  const payment = discovery.find(e => PAYMENT.test(`${e.title} ${e.snippet}`) && !/\b(?:unpaid|not paid|no pay|without pay)\b/i.test(e.snippet));
  const scope = SCOPE.test(text);
  const dates = discovery.map(e => ({ ...parseDisplayedDate(e.displayedDate, now), e })).filter(d => d.ageDays !== null);
  const date = dates.sort((a, b) => a.ageDays - b.ageDays)[0];
  const conflict = input.remote && ONSITE.test(text);
  const fullTime = /\bfull[- ]time\b/i.test(text) && !scope;
  const directory = /\b(?:jobs|job listings|top \d+|best \d+|find freelancers|hire freelancers)\b/i.test(candidate.title) && !/\b(?:at|for) [A-Z][a-z]/.test(candidate.title);
  if (payment) { score += 25; flags.push(reason('positive', 'Payment mentioned', 'The discovery text includes a rate, budget, or paid-work language. Payment is not independently verified.', payment.id, 25)); }
  else flags.push(reason('gap', 'Payment unclear', 'No explicit paid-work language was found in the available discovery text.', discovery[0]?.id));
  if (scope) { score += 20; flags.push(reason('positive', 'Project-shaped work', 'Freelance, contract, or scoped-project language appears in the discovery text.', discovery[0]?.id, 20)); }
  else flags.push(reason('gap', 'Scope unclear', 'Check whether this is a scoped project or a regular employment role.', discovery[0]?.id));
  if (date && !date.isLowerBound && date.ageDays <= 30) { score += 20; flags.push(reason('positive', 'Recent displayed date', `The search provider displays “${date.e.displayedDate}”. This may reflect an update, not the original publication date.`, date.e.id, 20)); }
  else if (date && date.ageDays > 60) { score -= 15; flags.push(reason('warning', 'Older displayed date', `The displayed date is about ${date.ageDays} days old. Check the original post and closing date.`, date.e.id, -15)); }
  else flags.push(reason('gap', 'Freshness unconfirmed', date ? date.isLowerBound ? 'The displayed age is a lower bound (for example, 30+ days). The actual posting may be older.' : 'The displayed date is over 30 days old.' : 'The search provider did not supply a date we can reliably interpret.', discovery[0]?.id));
  if (input.remote && REMOTE.test(text) && !conflict) { score += 10; flags.push(reason('positive', 'Remote language', 'Remote work is mentioned. Country, time-zone, and employment restrictions still need checking.', discovery[0]?.id, 10)); }
  if (candidate.corroboration === 'matched') { score += 10; flags.push(reason('positive', 'Status search matched', 'A targeted follow-up found the same URL or a closely matching title on the same domain. This is corroboration, not proof the opening is active.', candidate.evidence.find(e => e.kind === 'corroboration')?.id, 10)); }
  else flags.push(reason('gap', candidate.corroboration === 'no-match' ? 'No matching follow-up' : 'Follow-up not run', candidate.corroboration === 'no-match' ? 'The status search did not return a sufficiently matching result. Absence of a result does not prove closure.' : 'This candidate did not receive a status search within this run’s request budget.', discovery[0]?.id));
  if (conflict) { score -= 25; flags.push(reason('warning', 'Location restriction', 'On-site, hybrid, or residency-restriction language conflicts with an unrestricted remote search.', discovery[0]?.id, -25)); }
  if (fullTime) { score -= 15; flags.push(reason('warning', 'Employment-only signal', 'Full-time language appears without project or contract language.', discovery[0]?.id, -15)); }
  if (roster) { score -= 30; flags.push(reason('warning', 'Evergreen roster', 'This appears to invite future interest rather than describe an immediate opening.', roster.id, -30)); }
  if (directory) { score -= 20; flags.push(reason('gap', 'Broad listing page', 'This looks like a directory or roundup rather than one specific project. Find an individual opening before acting.', discovery[0]?.id, -20)); }
  if (closure) { score -= 60; flags.unshift(reason('warning', 'Closure language found', 'A matched search excerpt contains explicit closed, filled, or paused language. Open the source and verify before acting.', closure.id, -60)); }
  score = Math.min(95, Math.max(0, score));
  const bucket = closure || conflict || roster || fullTime ? 'caution' : !directory && payment && scope && date && !date.isLowerBound && date.ageDays <= 30 && score >= 65 ? 'promising' : 'verify';
  const nextStep = closure ? 'Check whether the source has reopened before investing time.' : roster ? 'Ask whether a funded project is open now, with a start date.' : conflict ? 'Confirm eligible countries, time zones, and employment terms.' : !payment ? 'Confirm the budget and payment terms before preparing a proposal.' : !date || date.ageDays > 30 ? 'Check the original publication date and whether applications remain open.' : 'Open the original source; confirm availability, scope, and payment.';
  return { ...candidate, score, bucket, reasons: flags, nextStep, freshness: date?.e.displayedDate || 'Date not supplied', ageDays: date?.ageDays ?? null, payment: payment ? extractRate(text) : 'Budget not stated', workStyle: REMOTE.test(text) ? (conflict ? 'Remote restrictions' : 'Remote mentioned') : candidate.location || 'Location unclear', policyVersion: POLICY_VERSION };
}
function extractRate(text) { return text.match(/(?:[$₹€£]\s?[\d,.]+(?:\s?[–-]\s?(?:[$₹€£]\s?)?[\d,.]+)?(?:\s?\/(?:hr|hour|day|month|project))?|(?:INR|USD|GBP|EUR)\s?[\d,.]+)/i)?.[0] || 'Paid work mentioned'; }
export function deduplicate(candidates) {
  const map = new Map(); let merged = 0;
  for (const item of candidates) {
    const key = canonicalUrl(item.url) || `${item.title.toLowerCase()}|${item.company.toLowerCase()}`;
    if (map.has(key)) { const existing = map.get(key); existing.evidence.push(...item.evidence); existing.duplicates = (existing.duplicates || 0) + 1; merged++; }
    else map.set(key, { ...item, evidence: [...item.evidence] });
  }
  return { candidates: [...map.values()], merged };
}
export function csvEscape(value) {
  let str = String(value ?? '');
  // Spreadsheet programs may execute formula-like cells, even inside CSV quotes.
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(str)) str = "'" + str;
  return '"' + str.replace(/"/g, '""') + '"';
}
export function exportCsv(candidates, mode, capturedAt) {
  const rows = [['Title', 'Organization', 'Signal bucket', 'Signal score (not probability)', 'Displayed date', 'Payment text', 'Source URL', 'Next step', 'Data mode', 'Captured at']];
  for (const c of candidates) rows.push([c.title, c.company, BUCKETS[c.bucket].title, c.score, c.freshness, c.payment, c.url, c.nextStep, c.synthetic ? 'example' : (c.savedMode || mode), c.savedCapturedAt || capturedAt]);
  return '\uFEFF' + rows.map(row => row.map(csvEscape).join(',')).join('\r\n');
}
