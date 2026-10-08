# NLR Alternative Fuel Stations SDK

Unofficial, read-only TypeScript SDK generated with the actual [Voxgig SDK Generator](https://voxgig.com/sdk). Supports listing stations and loading a station by ID. MIT, copyright Kish Arora. Not affiliated with NLR, NREL, or Voxgig.

## Run from this assessment branch

This SDK lives in a subdirectory of `kisharora/prooflane`, on the `voxgig-nlr-sdk-assessment` branch. It is **not published to npm**. Generated language documentation assumes a standalone repository; use these commands instead of its clone/install examples.

```sh
git clone --branch voxgig-nlr-sdk-assessment --single-branch https://github.com/kisharora/prooflane.git
cd prooflane/nlr-alt-fuel-stations-sdk
npm --prefix ts ci
npm --prefix ts test
node --test assessment/regression.test.cjs
```

Node 24 or newer is required for the generation toolchain. The checked-in SDK is source-only; `npm --prefix ts test` builds it before testing.

## Quickstart

After building the SDK, use its local generated entry point. Set the API key in your environment first.

```ts
import { NlrAltFuelStationsSDK } from './ts/dist/NlrAltFuelStationsSDK'

const client = new NlrAltFuelStationsSDK({
  apikey: process.env.NLR_ALT_FUEL_STATIONS_APIKEY,
})
const stations = await client.Station().list({ limit: 1, fuel_type: 'ELEC', state: 'CA' })
for (const station of stations) {
  console.log(station.data())
}
```

## Live example

The service officially publishes the literal `DEMO_KEY` for limited-rate testing. It is not a private credential. Supply a key via the environment, never in source:

```sh
NLR_ALT_FUEL_STATIONS_APIKEY=DEMO_KEY node assessment/live-smoke.cjs
```

This makes exactly two API requests: list one electric station in California, then load that station and verify its ID/name. It uses generated `client.Station().list(...)` and `client.Station().load(...)` methods, not a hand-written HTTP wrapper. Read the small [live example](assessment/live-smoke.cjs) and [generated types](ts/src/NlrAltFuelStationsTypes.ts).

The demo key is limited to 30 requests/hour and 50/day per IP. Normal tests are offline. No signup, private API key, account change, or npm release was performed.

## Results and limitations

- Generated suite after the documented component fix: 210 passed, 0 failed, 9 skipped.
- Additional API-specific regression tests: 6 passed, 0 failed.
- Live generated-client list + load: passed using the public demo key.
- Generator doctor: one expected fork, the disclosed suffix-placeholder test fix.
- Scope is deliberately small: two read operations, eight typed station fields, integer `limit` only. Additional upstream fields are preserved at runtime but are not all typed. No pagination, write operations, production credential validation, or full API coverage is claimed.

See [DX report](assessment/DX-REPORT.md), [reproduction notes](assessment/REPRODUCE.md), and [verification record](assessment/verification.json). Work was performed by an OpenAI-powered coding assistant with Kish's authorization; it was not represented as 30 minutes of Kish's manual coding.

## Regenerate

```sh
cd .sdk
npm ci
npm run generate
cd ..
npm --prefix ts ci
npm --prefix ts test
node --test assessment/regression.test.cjs
```

The OpenAPI subset is at [.sdk/def/openapi.json](.sdk/def/openapi.json). Project ownership/settings are in `.sdk/model/project.aontu`. The generator-component patch is retained in `.sdk/src/cmp/ts/TestDirect_ts.ts`; plain generation preserves it, but `target add ts` replaces it. Review [the patch](assessment/direct-placeholder-fix.patch) before resyncing.

## License

[MIT](LICENSE). Generator/template attribution is retained in [THIRD-PARTY-NOTICES](THIRD-PARTY-NOTICES.md). API data and service usage remain subject to their provider's terms; this code license does not relicense the upstream dataset.
