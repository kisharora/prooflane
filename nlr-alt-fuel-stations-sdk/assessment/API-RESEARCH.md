# API selection research

Checked 2026-10-08, approximately 16:49 UTC.

## Selected: NLR Alternative Fuel Stations API (formerly NREL)

The current working API host is `https://developer.nlr.gov`. A request to the old `developer.nrel.gov` host returned HTTP 502 in this environment. The current host returned HTTP 200 for all three probes below. This is a government data API, not a commercial SaaS product. It satisfies the API-key test through its officially published `DEMO_KEY`, without signup or private credential creation.

### Official sources

- Overview: https://developer.nlr.gov/docs/transportation/alt-fuel-stations-v1/
- List endpoint and filters: https://developer.nlr.gov/docs/transportation/alt-fuel-stations-v1/all/
- Single station and field schema: https://developer.nlr.gov/docs/transportation/alt-fuel-stations-v1/get/
- API-key use: https://developer.nlr.gov/docs/api-key/
- Demo-key example: https://developer.nlr.gov/docs/transportation/alt-fuel-stations-v1/last-updated/
- Rate limits: https://developer.nlr.gov/docs/rate-limits/
- U.S. government API gateway documentation independently publishes a DEMO_KEY example: https://api.data.gov/docs/developer-manual/

### Minimal implementation surface

Base URL: `https://developer.nlr.gov/api/alt-fuel-stations`

1. List: GET `/v1.json`. Response object contains `fuel_stations` (array of Station), `total_results` (integer), plus other metadata. Requires `api_key` string query parameter, or documented `X-Api-Key` header. Tested query authentication.
2. Load: GET `/v1/{id}.json`. Required integer path parameter `id`; same authentication. Response object contains `alt_fuel_station` (Station).

Useful list query parameters (all optional):
- `limit`: integer 0 through 200, or string `all`; upstream default `all`. A tiny SDK can deliberately expose integer limits only, with that subset documented.
- `state`: string, two-character state code, optionally comma-separated multiple codes; no default.
- `fuel_type`: string; `all`, `BD`, `CNG`, `ELEC`, `E85`, `HY`, `LNG`, `LPG`, `RD`; comma-separated codes supported; default `all`.
- `country`: string enum `all`, `US`, `CA`; default `US`.
- `status`: string; `all`, `E`, `P`, `T`, or comma-separated statuses; default `all`.
- `access`: string enum `all`, `public`, `private`; default `all`.

Do not invent pagination: no `offset` parameter is documented. List ordering is unspecified. Avoid the optional `response_format=compact` if names/addresses are needed; that mode returns only id, fuel_type_code, latitude and longitude.

Compact Station schema:
- `id`: integer
- `station_name`: string
- `fuel_type_code`: string
- `city`: string
- `state`: string
- `street_address`: string
- `latitude`: number, minimum -90, maximum 90
- `longitude`: number, minimum -180, maximum 180

There are many additional fields, including nullable fuel-specific fields; preserve additional properties rather than treating this eight-field subset as the complete upstream schema. All eight fields above were present and non-null in the verified station, but a single probe does not establish that every station always has them.

### Live verification

- `GET https://developer.nlr.gov/api/alt-fuel-stations/v1.json?api_key=DEMO_KEY&limit=1`: HTTP 200, JSON, total_results 103511, fuel_stations containing station id 17.
- `GET https://developer.nlr.gov/api/alt-fuel-stations/v1/17.json?api_key=DEMO_KEY`: HTTP 200, JSON with `alt_fuel_station.id=17`, name `Spire - Montgomery Operations Center`, city `Montgomery`, state `AL`, fuel type `CNG`, street address `2951 Chestnut St`, latitude 32.367916, longitude -86.267021.
- `GET https://developer.nlr.gov/api/alt-fuel-stations/v1/last-updated.json?api_key=DEMO_KEY`: HTTP 200, `{ "last_updated": "2026-10-08T16:46:32Z" }`.

### Catalog absence check

Catalog source: https://github.com/orgs/voxgig-sdk/repositories . Searched the locally gathered 804 repository names in `catalog-names-2026-10-08.txt` with case-insensitive `nrel|nlr|alternative|alt-fuel|fuel|charging`. Only result: `fuel-prices-at-spanish-gas-stations-sdk`, clearly a different API by its name. No NLR/NREL/alternative-fuel-stations match was found. This is a checked public catalog snapshot, not a guarantee against later additions or an undisclosed differently named repository.

### Demo-key budget

Official NLR limits for DEMO_KEY are 30 requests per IP per hour and 50 per IP per day. This research made three successful requests on the current domain; keep integration smoke tests sparse and use mocks for the normal test suite. Standard private-key limits (1,000/hour) do not apply to DEMO_KEY. Exceeded budgets return HTTP 429.
