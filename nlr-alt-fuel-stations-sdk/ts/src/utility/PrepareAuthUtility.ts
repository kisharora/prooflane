
import { Context, Spec } from '../types'


const CRED_name = 'api_key'

const OPTION_apikey = 'apikey'
const OPTION_secret = 'secret'

const NOTFOUND = '__NOTFOUND__'


// The client's `auth.name` option, when set, replaces the name the API declares.
function credName(name: any): string {
  return 'string' === typeof name && '' !== name ? name : CRED_name
}


function prepareAuth(ctx: Context): Spec | Error {
  const utility = ctx.utility

  const struct = utility.struct
  const getprop = struct.getprop
  const setprop = struct.setprop
  const delprop = struct.delprop

  const client = ctx.client
  const spec = ctx.spec

  if (null == spec) {
    return ctx.error('auth_no_spec', 'Expected context spec property to be defined.')
  }

  const query = spec.query

  const options = client.options()

  // Public APIs that need no auth omit the options.auth block entirely.
  if (null == options.auth) {
    delprop(query, CRED_name)
    return spec
  }

  const prefix = options.auth.prefix
  const name = credName(options.auth.name)

  // A credential left under the declared name would travel beside the renamed one.
  if (CRED_name !== name) {
    delprop(query, CRED_name)
  }

  const apikey = getprop(options, OPTION_apikey, NOTFOUND)

  if (NOTFOUND === apikey || null == apikey || '' === apikey) {
    delprop(query, name)
  }
  else {
    setprop(query, name, apikey)
  }

  return spec
}


export {
  prepareAuth
}
