
import { test, describe } from 'node:test'
import { equal } from 'node:assert'


import { NlrAltFuelStationsSDK } from '..'


describe('exists', async () => {

  test('test-mode', () => {
    const testsdk = NlrAltFuelStationsSDK.test()
    equal(testsdk instanceof NlrAltFuelStationsSDK, true,
      'NlrAltFuelStationsSDK.test() must return a client synchronously')
  })

})
