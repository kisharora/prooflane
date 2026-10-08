
import { BaseFeature } from './feature/base/BaseFeature'
import { TestFeature } from './feature/test/TestFeature'



const FEATURE_CLASS: Record<string, typeof BaseFeature> = {
   test: TestFeature,

}


const FEATURE_PLUGINS: Record<string, any[]> = {
  
}


class Config {

  makeFeature(this: any, fn: string) {
    const fc = FEATURE_CLASS[fn]
    const fi = new fc()
    return fi
  }

  // False for a feature added at runtime via options.extend (station's
  // adopt path) - the constructor uses this to skip makeFeature for names
  // no generated class backs.
  hasFeature(this: any, fn: string) {
    return null != FEATURE_CLASS[fn]
  }


  main = {
    name: 'NlrAltFuelStations',
        slug: "nlr-alt-fuel-stations",
    version: "0.0.1",
    target: "ts",

  }


  feature = {
     test:     {
      "options": {
        "active": false
      },
      "optspec": {
        "entity": "`$MAP`",
        "net": "`$MAP`"
      },
      "strict": false,
      "transport": "base"
    },

  }


  options = {
    base: "https://developer.nlr.gov/api",

    auth: {
      prefix: '',
      in: 'query',
      name: 'api_key',
    },

    headers: {
      "content-type": "application/json"
    },

    entity: {
      
        station: {
        },
  
    }
  }


  entity = {
    "station": {
      "fields": [
        {
          "name": "city",
          "title": "City",
          "type": "`$STRING`"
        },
        {
          "name": "fuel_type_code",
          "title": "Fuel Type Code",
          "type": "`$STRING`"
        },
        {
          "name": "id",
          "title": "Id",
          "type": "`$INTEGER`"
        },
        {
          "name": "latitude",
          "title": "Latitude",
          "type": "`$NUMBER`"
        },
        {
          "name": "longitude",
          "title": "Longitude",
          "type": "`$NUMBER`"
        },
        {
          "name": "state",
          "title": "State",
          "type": "`$STRING`"
        },
        {
          "name": "station_name",
          "title": "Station Name",
          "type": "`$STRING`"
        },
        {
          "name": "street_address",
          "title": "Street Address",
          "type": "`$STRING`"
        }
      ],
      "id": {
        "field": "id",
        "name": "id"
      },
      "name": "station",
      "op": {
        "list": {
          "input": "data",
          "name": "list",
          "points": [
            {
              "kind": "http",
              "method": "GET",
              "orig": "/alt-fuel-stations/v1.json",
              "segments": [
                {
                  "lit": "alt-fuel-stations"
                },
                {
                  "lit": "v1.json"
                }
              ],
              "parts": [
                "alt-fuel-stations",
                "v1.json"
              ],
              "rename": {},
              "transform": {
                "req": "`reqdata`",
                "res": "`body.fuel_stations`"
              },
              "args": {
                "query": [
                  {
                    "name": "fuel_type",
                    "orig": "fuel_type",
                    "type": "`$STRING`",
                    "kind": "query"
                  },
                  {
                    "name": "limit",
                    "orig": "limit",
                    "type": "`$INTEGER`",
                    "kind": "query"
                  },
                  {
                    "name": "state",
                    "orig": "state",
                    "type": "`$STRING`",
                    "kind": "query",
                    "field": true
                  }
                ]
              },
              "select": {},
              "response": {
                "kind": "json",
                "media": "application/json"
              }
            }
          ]
        },
        "load": {
          "input": "data",
          "name": "load",
          "points": [
            {
              "kind": "http",
              "method": "GET",
              "orig": "/alt-fuel-stations/v1/{id}.json",
              "segments": [
                {
                  "lit": "alt-fuel-stations"
                },
                {
                  "lit": "v1"
                },
                {
                  "lit": "{id}.json"
                }
              ],
              "parts": [
                "alt-fuel-stations",
                "v1",
                "{id}.json"
              ],
              "rename": {},
              "transform": {
                "req": "`reqdata`",
                "res": "`body.alt_fuel_station`"
              },
              "args": {
                "params": [
                  {
                    "name": "id",
                    "orig": "id",
                    "type": "`$INTEGER`",
                    "kind": "param",
                    "reqd": true
                  }
                ]
              },
              "select": {
                "exist": [
                  "id"
                ]
              },
              "response": {
                "kind": "json",
                "media": "application/json"
              }
            }
          ]
        }
      },
      "relations": {
        "ancestors": []
      }
    }
  }
}


const config = new Config()

export {
  config,
  FEATURE_PLUGINS,
}

