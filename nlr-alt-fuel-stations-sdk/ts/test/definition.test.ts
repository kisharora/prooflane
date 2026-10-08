import { describe, test } from 'node:test'
import { SDK } from '..'
import { runDefinitionPoint } from './definition-runner'
import { isControlSkipped } from './utility'


// Generated from the API definition, not from the model this SDK was built
// from: the route, the declared query parameters, the credential the security
// scheme names, and the definition's own response example.
const PLAN: any[] = [
  {
    "entity": "station",
    "accessor": "Station",
    "op": "list",
    "method": "GET",
    "path": "/alt-fuel-stations/v1.json",
    "args": [],
    "select": {
      "fuel_type": "v1",
      "limit": "v1",
      "state": "v1"
    },
    "headers": [],
    "cookies": [],
    "responseMedia": [
      "application/json"
    ],
    "query": [
      "limit",
      "fuel_type",
      "state"
    ],
    "queryArgs": [
      {
        "name": "fuel_type",
        "wire": "fuel_type"
      },
      {
        "name": "limit",
        "wire": "limit"
      },
      {
        "name": "state",
        "wire": "state"
      }
    ],
    "auth": [
      [
        {
          "in": "query",
          "name": "api_key"
        }
      ]
    ],
    "status": 200,
    "sample": {
      "fuel_stations": [
        {
          "id": 1,
          "station_name": "x",
          "fuel_type_code": "x",
          "city": "x",
          "state": "x",
          "street_address": "x",
          "latitude": 1,
          "longitude": 1
        }
      ]
    },
    "idField": "id",
    "ownQuery": "api_key"
  },
  {
    "entity": "station",
    "accessor": "Station",
    "op": "load",
    "method": "GET",
    "path": "/alt-fuel-stations/v1/{id}.json",
    "args": [
      {
        "name": "id",
        "wire": "id",
        "value": "p1"
      }
    ],
    "select": {},
    "headers": [],
    "cookies": [],
    "responseMedia": [
      "application/json"
    ],
    "query": [],
    "queryArgs": [],
    "auth": [
      [
        {
          "in": "query",
          "name": "api_key"
        }
      ]
    ],
    "status": 200,
    "sample": {
      "alt_fuel_station": {
        "id": 1,
        "station_name": "x",
        "fuel_type_code": "x",
        "city": "x",
        "state": "x",
        "street_address": "x",
        "latitude": 1,
        "longitude": 1
      }
    },
    "idField": "id",
    "ownQuery": "api_key"
  }
]


describe('definition', () => {
  for (const point of PLAN) {
    test(point.entity + '.' + point.op + ' ' + point.method + ' ' + point.path, async (t) => {
      const control = isControlSkipped('entityOp', point.entity + '.' + point.op, 'definition')
      if (control.skip) {
        t.skip(control.reason || 'skipped via sdk-test-control.json')
        return
      }
      await runDefinitionPoint(SDK, point)
    })
  }
})
