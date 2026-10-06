# Prooflane

**Opportunity research, with receipts.**

Prooflane helps freelancers decide which project leads deserve their time. It combines SerpApi discovery with candidate-specific status searches, preserving the evidence behind every classification.

A fresh search result can be an old hiring thread with a new reply. A “remote” job can require residency in one country. A paid talent roster can have no immediate opening. Prooflane makes those distinctions visible before you spend an evening writing proposals.

## Run locally

Requirements: **Node.js 22 or newer**. No package installation or paid LLM subscription is needed.

```sh
git clone https://github.com/kisharora/prooflane.git
cd prooflane
npm start
```

Open **http://127.0.0.1:4173**. The server binds only to loopback by default. The fictional example workspace works immediately, without a SerpApi key.

### Live search: one-run local handoff

1. Open the app on the same computer using the loopback URL above.
2. Click **Try live search** or choose **Live SerpApi search**.
3. In the local setup form, manually enter your own SerpApi API key. Do not paste it into a chat or record this step.
4. Click **Use for my next run**. This does not make a search.
5. Set your skill and location, choose a request budget, then explicitly click **Find opportunities**.

The key is held only in server memory, consumed by one run, and discarded afterward. It expires after ten minutes if unused. You can also forget it from the live-search information panel, or stop the server. It is never returned by the API, written to a file, logged, stored in browser storage, or included in exports. The setup endpoint requires both a loopback connection and a localhost/127.0.0.1 host header. The public static demo does not accept keys.

### Live search: environment configuration

For repeated local use, copy `.env.example` to `.env`, set `SERPAPI_API_KEY` in that local file, and restart the server. `.env` is ignored by Git. Environment configuration stays in place across runs until you remove it and restart. Do not commit or share the file.

The key is transmitted only to SerpApi over HTTPS when you explicitly start a live research run. Search settings and candidate-specific corroboration queries are sent to SerpApi. Provider terms and your account's credits apply. No automatic purchase, signup, upgrade, or top-up occurs.

## What works

- Skill/service, location, and remote-friendly search settings
- Hard per-run budgets of 3, 5, or 8 provider requests
- Google web and Google Jobs discovery through the real SerpApi API
- Targeted status checks for the strongest candidates
- Canonical URL deduplication with evidence preservation
- Three lanes: promising signals, needs checking, caution signals
- An evidence drawer with source links, excerpts, exact queries, displayed dates, capture dates, and explanations
- Browser-local shortlist and private notes
- Text research briefs and formula-safe CSV exports
- Explicit example, live, and optional recorded-data modes
- Partial-result handling, total-failure preservation of the previous board, timeout and limit states
- Responsive layout, keyboard-accessible native dialogs, reduced-motion support, and optional WebMCP tools

## Why SerpApi is essential

Prooflane calls the documented `https://serpapi.com/search.json` endpoint with two engines:

1. **`google`** discovers web opportunity signals. The discovery query combines the user's skill with freelance, contract, project, payment, and location terms, with a recent-result filter.
2. **`google_jobs`** supplies structured role, company, location, application-link, and displayed-age fields.
3. The remaining budget funds **candidate-specific `google` status queries**. Only sufficiently matching results become corroboration evidence. Unrelated closure results are rejected.

Without SerpApi, the live discovery and corroboration flow does not work. The fixture workspace is a separate, explicitly fictional demonstration of the interface and rules, not a substitute for live integration.

Documentation: [Google Search API](https://serpapi.com/search-api) · [Google Jobs API](https://serpapi.com/google-jobs-api)

## Trust model and limitations

**A signal score is not a probability, verification, or guarantee.** English-language deterministic rules prioritize research; they do not establish employer legitimacy, payment reliability, or current availability.

- Provider-displayed dates may refer to updates or replies. Search capture timestamps are never used as publication dates.
- `30+ days ago` is treated as an uncertain lower bound, not proof of freshness.
- Tracking parameters are removed for deduplication; meaningful job identifiers are preserved.
- Forum and job-platform corroboration requires full canonical URL identity, including meaningful query parameters.
- On other domains, a follow-up can match the same URL or a sufficiently distinctive, closely matching title on the same domain. This heuristic can still be imperfect.
- A missing follow-up result is not evidence that an opening is closed.
- Broad directories cannot enter the promising lane.
- Keyword rules can miss negation, subtle context, eligibility constraints, and non-English content. Search snippets can be incomplete, misleading, or stale.
- No pages are scraped directly, no access restrictions are bypassed, and no employer outreach or contact harvesting occurs.

Always inspect the original source and verify availability, scope, eligibility, and payment before acting. See [signal policy](docs/SIGNAL_POLICY.md) and [security notes](docs/SECURITY.md).

## Request and cost controls

- At most the chosen 3/5/8 planned queries per run; 2 for discovery, the remainder for corroboration
- No pagination or automatic retries
- Maximum two concurrent calls during discovery or corroboration batches
- 12-second per-request timeout and 55-second overall run deadline
- 15-minute in-memory query cache, bounded to 120 entries per provider client
- Default process-wide cap of 24 outbound requests per hour, shared across one-run keys; configurable through `MAX_REQUESTS_PER_HOUR` up to a hard ceiling of 100
- One research run at a time on a local server

Local cache hits do not trigger provider requests. The app counts attempted outbound calls, not charged credits: SerpApi determines billing and may serve its own cache. One-run keys intentionally discard their client/cache after the run.

## Tests

```sh
npm test
npm run check
```

The automated suite uses dummy credentials and mocked provider responses. It covers rules, date ambiguity, URL identity, unrelated closure rejection, budgets, cache, timeouts, sanitized errors, safe exports, the real HTTP handler contract, local-only setup, and one-run key lifecycle. No real searches or paid services are needed to run the tests.

The HTTP-handler tests call the actual handler without opening a listening socket. They are not a substitute for a local browser smoke test or a genuine live SerpApi demonstration. Live functionality should be demonstrated separately with the user's own configured key.

## Structure

```text
server.mjs               Local HTTP server and protected API routes
lib/serpapi.mjs           Real SerpApi client, normalization, matching
lib/research.mjs          Bounded discovery/corroboration pipeline
lib/session-key.mjs       Loopback-only, one-run key handoff
dist/                    Static public-safe UI and shared rule engine
test/                    Deterministic regression tests
docs/                    Policy, security, AI disclosure, demo guide
```

The static `dist/` directory can be hosted separately as an example-only demo. Its configuration disables live search and key entry. The live backend is deliberately local. A recorded live run, when available, must be labeled `recorded`, retain its actual capture timestamp, and contain only public-safe sanitized result fields; no recording is bundled by default.

## Hackathon entry

- Track: **Open Innovation**
- New project created for the SerpApi India Hackathon 2026
- Runtime: Node.js + browser JavaScript; no paid LLM dependency
- [AI assistance disclosure](docs/AI_DISCLOSURE.md)
- [Under-three-minute local demo guide](docs/DEMO_GUIDE.md)

Original project code is published for inspection and hackathon judging. No general open-source license is granted at this time. Third-party services and assets retain their own terms and licenses; see [third-party notices](docs/THIRD_PARTY_NOTICES.md).
