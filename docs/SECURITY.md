# Security and privacy notes

## Local-first trust boundary

The default server listens on 127.0.0.1. Do not expose a key-backed instance directly to the public internet. The included public static configuration has no live API, no shared credential, and no functioning key-entry endpoint.

The optional one-run key handoff requires a loopback peer and localhost/127.0.0.1 Host header. It accepts only JSON, rejects cross-origin requests, returns no key, and retains the key only in memory for one explicit run or at most ten idle minutes. Forgetting it also aborts an active run. JavaScript does not guarantee physical zeroization of previously allocated memory. Stopping the process discards the session.

Environment keys are read by the server only and remain configured until removed and the process is restarted. .env is ignored. Never put a key in public assets, command-line arguments, screenshots, recordings, chat, logs, or commits.

## Network behavior

Live requests go only to the fixed HTTPS SerpApi endpoint. Redirects are rejected. URLs from results are never fetched by the server. Only HTTP(S) source links without embedded credentials are displayed; the user chooses whether to open them. Requests have timeouts, hard budgets, one-run concurrency control, a bounded cache, and a shared process-wide hourly cap. Provider error text and search parameters are not returned to the browser.

The user’s search terms and candidate follow-up queries are transmitted to SerpApi. Provider search IDs and provider-created timestamps can be shown for auditability. Provider API URLs and keys are removed. Search snippets can still contain public personal data or misleading material; review before publishing a recording or recorded dataset.

## Browser behavior

All dynamic text is HTML-escaped. External links use safe protocols and noopener/noreferrer. CSV cells are quoted and formula-like prefixes are neutralized. Shortlists and notes stay in browser-local storage and can be cleared. They are never sent to employers or SerpApi. Browser-local storage is not encrypted and should not be used for secrets.

There is no analytics or telemetry. Fonts are optionally loaded from Google Fonts; system fallbacks work if that service is unavailable. A static host applies its own HTTP headers. The local server adds content security, frame, MIME-sniffing, and referrer protections.

## Scope limitations

This is a local research tool, not a hardened multi-tenant service. It has no accounts, public authentication, employer verification, encrypted sync, or production abuse-management layer. Do not deploy the live backend publicly without additional authentication, per-user quotas, deployment-specific security review, and user authorization.
