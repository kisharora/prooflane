# Voxgig SDK Generator: short DX report

**API:** NLR Alternative Fuel Stations (formerly NREL), two GET operations: list and load by ID. No matching repository name appeared in the 804-entry Voxgig SDK catalog snapshot checked on 2026-10-08. The input is a documented subset rather than the full upstream API.

**Toolchain used:** `@voxgig/create-sdkgen 0.30.6`, `@voxgig/sdkgen 4.34.2`, `@voxgig/apidef 8.25.0`; exact remaining versions are in the lockfile.

## What worked well

- Scaffolding, model generation and TypeScript compilation were fast once the dependency mismatch was corrected.
- The generated semantic API is concise: `client.Station().list({ limit: 1, fuel_type: 'ELEC', state: 'CA' })` and `client.Station().load({ id })`.
- The generator correctly inferred query-key authentication and both distinct response envelopes: `fuel_stations` for list and `alt_fuel_station` for load. Live requests through the generated SDK passed.
- The offline test suite and doctor command made the defect and the intentional local fork visible. Model-level publisher/package settings correctly produced Kish Arora's MIT attribution.

## Reproducible problems

1. **Fresh-install dependency conflict (blocks the quickstart).** The current scaffold pins apidef `~8.22.1`, while its sdkgen range resolves to `4.34.2`, whose peer dependency is apidef `>=8.25.0`. npm fails with ERESOLVE. Updating only the local scaffold's apidef dependency to the published `8.25.0` allowed install and generation. Recommendation: release compatible scaffold pins and test the default command against the registry's currently resolvable versions.
2. **Generated direct-load test misses suffix placeholders.** The path `{id}.json` is a valid API route. The test generator recognizes only whole-segment `{id}`, leaving `params.id` unset in the offline test. Baseline: 209 pass / 1 fail / 9 skip. A small component patch plus regeneration yields 210 pass / 0 fail / 9 skip. The patch is included and doctor correctly flags its one fork. Recommendation: recognize placeholders anywhere in a segment and retain this suffix-path regression case.
3. **Scaffold conflicts with generator tracking advice.** Its `.sdk/.gitignore` ignores `log/`, but current sdkgen warns that `log/copies.jsonl` and `log/generated.jsonl` should be committed for drift/pruning behavior. Removed that ignore entry and kept those records. Recommendation: scaffold the required tracking policy directly.

## Other observations and limits

- Current API hostname is `developer.nlr.gov`; the old `developer.nrel.gov` failed in this environment. This is an upstream/environment finding, not attributed to Voxgig.
- Generated standalone-repository install examples need adaptation for this branch/subdirectory publication. The authored root README provides verified commands.
- Authentication testing used the provider's public `DEMO_KEY`, not a newly issued private key. Two generated-client live calls passed. Six authored API-specific regression tests passed offline. Skips in the generated suite are retained and are not counted as passes.
- The work was performed by an OpenAI-powered coding assistant with Kish's authorization within a bounded assessment attempt. Engineering/verification ran from 16:45:36 to 17:01:00 UTC on 2026-10-08 (15 minutes 24 seconds); publication followed within the same 30-minute cap. The verification record states the timings and results. It does not claim that Kish manually coded for 30 minutes or that either assessment payment has been earned.

[Reproduction steps](REPRODUCE.md) · [Verification record](verification.json) · [API sources](API-RESEARCH.md)
