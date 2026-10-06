# Local demonstration guide — target 2:30, maximum under 3:00

Record the real application running at http://127.0.0.1:4173, with its local address visible at least once. The contest requires a local screen recording. A recording of a static hosted page alone does not meet that requirement.

## Before recording

1. Run `npm test` and `npm run check`, then `npm start`.
2. Verify the example workspace renders correctly and that evidence drawers, keyboard navigation, shortlist, notes, and exports work.
3. The user manually enters their own SerpApi key through the local-only one-run setup. Do not record the key-entry step, account pages, private tabs, or personal details.
4. Use at most **5 provider requests** for the demonstration run. Confirm that the user wants to consume those free credits. Use a practical query such as “n8n automation”, location “India”, remote-friendly, balanced budget.
5. Ensure the recording output folder is outside the repository. Review the full recording for sensitive information before sharing it publicly.

## Suggested sequence

- **0:00–0:20:** Show the local app and explain the problem: fresh-looking search results can be old threads, filled roles, or evergreen rosters.
- **0:20–1:05:** Select live mode and run the real SerpApi flow. Show the request budget and actual results. If the network wait is long, trim or speed up that segment; do not misrepresent completion or fabricate results.
- **1:05–1:35:** Open one candidate's evidence file. Show its exact search query, source link, displayed date versus capture date, reasons, and next verification step. Do not claim a role is verified.
- **1:35–1:55:** Open Search trail. Show Google web, Google Jobs, and targeted follow-ups, with actual request counts and any partial-provider warning.
- **1:55–2:20:** Save a candidate, add a non-sensitive note, open the shortlist, export a text brief or CSV, and show the exported result.
- **2:20–2:40:** Optionally switch to the explicitly fictional example workspace to show the closed-trial or evergreen-roster edge case if live results did not include it. Clearly say this segment uses fictional fixtures.
- **2:40–2:50:** Close with the open-to-inspection rule policy, the fact that scores are signals rather than probabilities, and the AI assistance disclosure.

## Honesty checklist

- A live run must actually call SerpApi and return real data; dummy test responses do not count.
- Keep example, live, and recorded modes visible and accurately described.
- A provider outage or no-results response must be shown honestly; do not splice a fictional board under a live label.
- If a genuine live run cannot be completed, report that limitation and do not describe the entry as fully demonstrated.
- The final publicly shared link must open without login or access requests, and the total video length must be under three minutes.

## Optional Playwright helper

`scripts/demo-driver.mjs` uses an independently installed, approved Playwright package and a fresh isolated browser context. It never opens normal browser profiles and accepts only a loopback app URL. A context-wide route guard blocks every request outside that exact origin, including external fonts, and unexpected new pages are closed. It never reads or enters a key. A small factual recording caption shows the verified local origin; it does not simulate browser chrome.

First run visual QA (no real API calls):

```sh
node scripts/demo-driver.mjs --mode=check --playwright-module=/absolute/path/to/playwright/index.mjs --executable=/absolute/path/to/browser --out=/private/output-folder
```

Review the generated desktop/mobile board, evidence, shortlist, and trail screenshots before recording. After the user manually configures a one-run key and authorizes up to five live calls:

```sh
node scripts/demo-driver.mjs --mode=record --live-authorized --playwright-module=/absolute/path/to/playwright/index.mjs --executable=/absolute/path/to/browser --out=/private/output-folder --skill="n8n automation" --location=India
```

The helper records the actual local UI, rejects a failed or empty live run, preserves explicit example labels for the edge-case segment, saves review-only sanitized results outside the repository, and has a 165-second safety deadline. It does not publish anything. Check final duration independently and review the entire video before public sharing. Do not include the review-only JSON artifact automatically.
