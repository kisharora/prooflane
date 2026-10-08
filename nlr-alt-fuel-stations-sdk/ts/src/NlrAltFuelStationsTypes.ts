// Typed models for the NlrAltFuelStations SDK.
//
// GENERATED from the API model: main.kit.entity.<e>.fields{} and per-op
// params (op.<name>.points[].g.params[]). Field/param types come from the
// canonical type sentinels via @voxgig/sdkgen canonToType (source of truth:
// @voxgig/apidef VALID_CANON). Do not edit by hand.

export interface Station {
  city?: string
  fuel_type_code?: string
  id?: number
  latitude?: number
  longitude?: number
  state?: string
  station_name?: string
  street_address?: string
}

export interface StationLoadMatch {
  id: number
}

export interface StationListMatch {
  fuel_type?: string
  limit?: number
  state?: string
}

