'use strict'
const assert = require('node:assert/strict')
const { NlrAltFuelStationsSDK } = require('../ts/dist/NlrAltFuelStationsSDK')

async function main() {
  const apikey = process.env.NLR_ALT_FUEL_STATIONS_APIKEY
  if (!apikey) throw new Error('Set NLR_ALT_FUEL_STATIONS_APIKEY. The official public DEMO_KEY is supported.')
  const client = new NlrAltFuelStationsSDK({ apikey })
  const stations = await client.Station().list({ limit: 1, fuel_type: 'ELEC', state: 'CA' })
  assert.equal(stations.length, 1)
  const first = stations[0].data()
  assert.equal(first.fuel_type_code, 'ELEC')
  assert.equal(first.state, 'CA')
  assert.equal(typeof first.id, 'number')
  const loaded = (await client.Station().load({ id: first.id })).data()
  assert.equal(loaded.id, first.id)
  assert.equal(loaded.station_name, first.station_name)
  console.log(JSON.stringify({ result: 'PASS', requests: 2, auth: apikey === 'DEMO_KEY' ? 'public-demo-key' : 'environment-key', station: { id: loaded.id, name: loaded.station_name, state: loaded.state } }, null, 2))
}
main().catch(error => { console.error('Live smoke failed:', error.message); process.exitCode = 1 })
