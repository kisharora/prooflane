# Reproduction and provenance

## Environment

Node v24.19.0, npm 11.9.0, Linux. Official npm packages only. `NPM_CONFIG_CACHE=/tmp/voxgig-npm` was used because this execution environment's default npm cache directory was not writable; that is an environment limitation, not a Voxgig bug.

## Initial generation

The OpenAPI subset was authored from official NLR documentation, then passed to Voxgig's real scaffold and generator:

```sh
npm exec --yes --package @voxgig/create-sdkgen@0.30.6 -- create-sdkgen nlr-alt-fuel-stations -d ./input/openapi.json -o ./nlr-alt-fuel-stations-sdk -t ts -f test
```

The initial command wrote the scaffold but failed during dependency installation. Its manifest pinned `@voxgig/apidef` to `~8.22.1` and `@voxgig/sdkgen` to `~4.34.0`. On 2026-10-08, the latter resolved to `4.34.2`, which requires apidef `>=8.25.0`. npm rejected the dependency tree with ERESOLVE.

The sole dependency workaround was to set `.sdk/package.json`'s `@voxgig/apidef` to the published version `8.25.0`. No `--force` or `--legacy-peer-deps` was used. The resulting exact tree is captured in `.sdk/package-lock.json`.

```sh
cd nlr-alt-fuel-stations-sdk/.sdk
npm install
npm run add-target -- ts
npm run add-feature -- test
npm run generate
cd ../ts
npm install
npm run build
npm test
```

## Baseline and small fix

The baseline generated suite built but reported 209 passing tests, 1 failing test, and 9 skips. `StationDirect` / `direct-load-station` omitted `params.id`, although the actual path is `alt-fuel-stations/v1/{id}.json`.

In `.sdk/src/cmp/ts/TestDirect_ts.ts`, placeholder discovery required a whole path segment to end with `}`. The fix detects every `{name}` inside each segment with a regular expression. See `direct-placeholder-fix.patch`. The generated SDK runtime was **not** hand-edited. Regeneration produces the corrected test.

After the patch, the generated suite has 210 passing tests, no failures, and 9 skips. The six additional API-specific regression tests exercise authentication, filters, suffix paths, response envelopes, empty results, and HTTP error rejection.

`npx voxgig-sdkgen doctor` was clean before this patch. Afterward, it returns nonzero with exactly one expected fork: `src/cmp/ts/TestDirect_ts.ts`. This is deliberately disclosed, not claimed as a clean doctor run. Running `target add ts` would resync and discard the fix; preserve/reapply it or wait for an upstream release.

The scaffold ignored `.sdk/log/`, despite sdkgen warning that its copy and generated-file records should be committed. The ignore rule was removed and those two JSONL records are included. Ephemeral logs are excluded.

## Auth and live-test boundaries

`NLR_ALT_FUEL_STATIONS_APIKEY=DEMO_KEY node assessment/live-smoke.cjs` passed through the generated SDK with two live requests. The API key is the provider's published demonstration value, not a private credential. No private account, signup, credential generation, production entitlement, write operation, invalid-key live request, or complete API contract was tested. Error cases use mock responses.

## Publication layout

The code is published only in `nlr-alt-fuel-stations-sdk/` on the dedicated `voxgig-nlr-sdk-assessment` branch of the owner's existing public repository. The main branch is unchanged. Generated GitHub workflow templates are omitted from this source-only assessment; no npm publishing workflow was enabled or dispatched. Follow the root README for this nested checkout's installation commands.

## Clean-checkout verification

An exported source-only tree was installed with `npm --prefix ts ci`, built and tested successfully. Its generator was separately installed with `npm ci` in `.sdk`, then `npm run generate` succeeded. Re-running all tests remained green (210 generated passes, 9 skips, 6 regression passes). Generated TypeScript source was byte-for-byte identical after this clean regeneration. Doctor reported only the single documented component fork.
