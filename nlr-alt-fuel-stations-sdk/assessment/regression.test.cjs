'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { NlrAltFuelStationsSDK } = require('../ts/dist/NlrAltFuelStationsSDK')
const station = { id: 17, station_name: 'Example station', fuel_type_code: 'ELEC', state: 'CA', city: 'Example', street_address: '1 Main St', latitude: 34, longitude: -118 }

function setup(body, status = 200, apikey = 'test-key-not-a-secret') {
  const calls = []
  const client = new NlrAltFuelStationsSDK({ apikey, system: { fetch: async (url, init) => {
    calls.push({ url: new URL(url), init })
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  } } })
  return { client, calls }
}

test('list sends documented filters and query API key; unwraps fuel_stations', async () => {
  const { client, calls } = setup({ fuel_stations: [station], total_results: 1 })
  const entities = await client.Station().list({ limit: 1, state: 'CA', fuel_type: 'ELEC' })
  assert.equal(entities.length, 1)
  assert.deepEqual(entities[0].data(), station)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url.origin, 'https://developer.nlr.gov')
  assert.equal(calls[0].url.pathname, '/api/alt-fuel-stations/v1.json')
  assert.deepEqual(Object.fromEntries(calls[0].url.searchParams), { fuel_type: 'ELEC', limit: '1', state: 'CA', api_key: 'test-key-not-a-secret' })
  assert.equal(calls[0].init.method, 'GET')
})

test('load expands a suffix path placeholder and unwraps alt_fuel_station', async () => {
  const { client, calls } = setup({ alt_fuel_station: station })
  assert.deepEqual((await client.Station().load({ id: 17 })).data(), station)
  assert.equal(calls[0].url.pathname, '/api/alt-fuel-stations/v1/17.json')
  assert.equal(calls[0].url.searchParams.get('api_key'), 'test-key-not-a-secret')
})

test('direct preserves the raw response envelope and expands suffix placeholder', async () => {
  const { client, calls } = setup({ alt_fuel_station: station })
  const result = await client.direct({ method: 'GET', path: 'alt-fuel-stations/v1/{id}.json', params: { id: 17 } })
  assert.equal(result.ok, true)
  assert.equal(result.status, 200)
  assert.deepEqual(result.data, { alt_fuel_station: station })
  assert.equal(calls[0].url.pathname, '/api/alt-fuel-stations/v1/17.json')
})

test('empty list response becomes an empty entity list', async () => {
  const { client } = setup({ fuel_stations: [], total_results: 0 })
  assert.deepEqual(await client.Station().list({ limit: 1 }), [])
})

test('401 API-key failure rejects the entity operation', async () => {
  const { client, calls } = setup({ error: { code: 'API_KEY_INVALID', message: 'Invalid API key' } }, 401)
  await assert.rejects(client.Station().list({ limit: 1 }))
  assert.equal(calls.length, 1)
})

test('missing key does not invent or send an API key', async () => {
  const { client, calls } = setup({ fuel_stations: [] }, 200, '')
  await client.Station().list({ limit: 1 })
  assert.equal(calls[0].url.searchParams.has('api_key'), false)
})
