/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict'

const ROOT_DIR = '../../..'

const assert = require('insist')
const crypto = require('crypto')
const proxyquire = require('proxyquire')
const sinon = require('sinon')
const mocks = require('../../mocks')
const P = require(`${ROOT_DIR}/lib/promise`)

const modulePath = `${ROOT_DIR}/lib/metrics/context`
const metricsContextModule = require(modulePath)

function hashToken (token) {
  const hash = crypto.createHash('sha256')
  hash.update(token.uid)
  hash.update(token.id)

  return hash.digest('base64')
}

describe('metricsContext', () => {
  let results, cache, cacheFactory, log, config, metricsContext

  beforeEach(() => {
    results = {
      del: P.resolve(),
      get: P.resolve(),
      set: P.resolve()
    }
    cache = {
      del: sinon.spy(() => results.del),
      get: sinon.spy(() => results.get),
      set: sinon.spy(() => results.set)
    }
    cacheFactory = sinon.spy(() => cache)
    log = mocks.mockLog()
    config = {}
    metricsContext = proxyquire(modulePath, { '../cache': cacheFactory })(log, config)
  })

  it(
    'metricsContext interface is correct',
    () => {
      assert.equal(typeof metricsContextModule, 'function', 'function is exported')
      assert.equal(typeof metricsContextModule.schema, 'object', 'metricsContext.schema is object')
      assert.notEqual(metricsContextModule.schema, null, 'metricsContext.schema is not null')

      assert.equal(typeof metricsContext, 'object', 'metricsContext is object')
      assert.notEqual(metricsContext, null, 'metricsContext is not null')
      assert.equal(Object.keys(metricsContext).length, 5, 'metricsContext has 5 properties')

      assert.equal(typeof metricsContext.stash, 'function', 'metricsContext.stash is function')
      assert.equal(metricsContext.stash.length, 1, 'metricsContext.stash expects 1 argument')

      assert.equal(typeof metricsContext.gather, 'function', 'metricsContext.gather is function')
      assert.equal(metricsContext.gather.length, 1, 'metricsContext.gather expects 1 argument')

      assert.equal(typeof metricsContext.clear, 'function', 'metricsContext.clear is function')
      assert.equal(metricsContext.clear.length, 0, 'metricsContext.gather expects no arguments')

      assert.equal(typeof metricsContext.validate, 'function', 'metricsContext.validate is function')
      assert.equal(metricsContext.validate.length, 0, 'metricsContext.validate expects no arguments')

      assert.equal(typeof metricsContext.setFlowCompleteSignal, 'function', 'metricsContext.setFlowCompleteSignal is function')
      assert.equal(metricsContext.setFlowCompleteSignal.length, 2, 'metricsContext.setFlowCompleteSignal expects 2 arguments')

    }
  )

  it('instantiated cache correctly', () => {
    assert.equal(cacheFactory.callCount, 1)
    const args = cacheFactory.args[0]
    assert.equal(args.length, 3)
    assert.equal(args[0], log)
    assert.equal(args[1], config)
    assert.equal(args[2], 'fxa-metrics~')
  })

  it(
    'metricsContext.stash',
    () => {
      results.set = P.resolve('wibble')
      const token = {
        uid: Array(64).fill('c').join(''),
        id: 'foo'
      }
      return metricsContext.stash.call({
        payload: {
          metricsContext: {
            foo: 'bar'
          },
          service: 'baz'
        },
        query: {}
      }, token).then(result => {
        assert.equal(result, 'wibble', 'result is correct')

        assert.equal(cache.set.callCount, 1, 'cache.set was called once')
        assert.equal(cache.set.args[0].length, 2, 'cache.set was passed two arguments')
        assert.equal(cache.set.args[0][0], hashToken(token), 'first argument was correct')
        assert.deepEqual(cache.set.args[0][1], {
          foo: 'bar',
          service: 'baz'
        }, 'second argument was correct')

        assert.equal(log.error.callCount, 0, 'log.error was not called')
      })
    }
  )

  it(
    'metricsContext.stash with service query param',
    () => {
      results.set = P.resolve('wibble')
      const token = {
        uid: Array(64).fill('c').join(''),
        id: 'foo'
      }
      return metricsContext.stash.call({
        payload: {
          metricsContext: {
            foo: 'bar'
          }
        },
        query: {
          service: 'qux'
        }
      }, token).then(result => {
        assert.equal(cache.set.callCount, 1, 'cache.set was called once')
        assert.equal(cache.set.args[0][1].service, 'qux', 'service property was correct')

        assert.equal(log.error.callCount, 0, 'log.error was not called')
      })
    }
  )

  it(
    'metricsContext.stash error',
    () => {
      results.set = P.reject('wibble')
      return metricsContext.stash.call({
        payload: {
          metricsContext: {
            foo: 'bar'
          }
        },
        query: {}
      }, {
        uid: Array(64).fill('c').join(''),
        id: 'foo'
      }).then(result => {
        assert.equal(result, undefined, 'result is undefined')

        assert.equal(cache.set.callCount, 1, 'cache.set was called once')

        assert.equal(log.error.callCount, 1, 'log.error was called once')
        assert.equal(log.error.args[0].length, 1, 'log.error was passed one argument')
        assert.equal(log.error.args[0][0].op, 'metricsContext.stash', 'argument op property was correct')
        assert.equal(log.error.args[0][0].err, 'wibble', 'argument err property was correct')
        assert.strictEqual(log.error.args[0][0].hasToken, true, 'hasToken property was correct')
        assert.strictEqual(log.error.args[0][0].hasId, true, 'hasId property was correct')
        assert.strictEqual(log.error.args[0][0].hasUid, true, 'hasUid property was correct')
      })
    }
  )

  it(
    'metricsContext.stash with bad token',
    () => {
      return metricsContext.stash.call({
        payload: {
          metricsContext: {
            foo: 'bar'
          }
        },
        query: {}
      }, {
        id: 'foo'
      }).then(result => {
        assert.equal(result, undefined, 'result is undefined')

        assert.equal(log.error.callCount, 1, 'log.error was called once')
        assert.equal(log.error.args[0].length, 1, 'log.error was passed one argument')
        assert.equal(log.error.args[0][0].op, 'metricsContext.stash', 'op property was correct')
        assert.equal(log.error.args[0][0].err.message, 'Invalid token', 'err.message property was correct')
        assert.strictEqual(log.error.args[0][0].hasToken, true, 'hasToken property was correct')
        assert.strictEqual(log.error.args[0][0].hasId, true, 'hasId property was correct')
        assert.strictEqual(log.error.args[0][0].hasUid, false, 'hasUid property was correct')

        assert.equal(cache.set.callCount, 0, 'cache.set was not called')
      })
    }
  )

  it(
    'metricsContext.stash without metadata',
    () => {
      return metricsContext.stash.call({
        payload: {},
        query: {}
      }, {
        uid: Array(64).fill('c').join(''),
        id: 'foo'
      }).then(result => {
        assert.equal(result, undefined, 'result is undefined')

        assert.equal(cache.set.callCount, 0, 'cache.set was not called')
        assert.equal(log.error.callCount, 0, 'log.error was not called')
      })
    }
  )

  it(
    'metricsContext.gather with metadata',
    () => {
      results.get = P.resolve({
        flowId: 'not this flow id',
        flowBeginTime: 0
      })
      const time = Date.now() - 1
      return metricsContext.gather.call({
        payload: {
          metricsContext: {
            deviceId: 'mock device id',
            flowId: 'mock flow id',
            flowBeginTime: time,
            flowCompleteSignal: 'mock flow complete signal',
            flowType: 'mock flow type',
            context: 'mock context',
            entrypoint: 'mock entry point',
            migration: 'mock migration',
            service: 'mock service',
            utmCampaign: 'mock utm_campaign',
            utmContent: 'mock utm_content',
            utmMedium: 'mock utm_medium',
            utmSource: 'mock utm_source',
            utmTerm: 'mock utm_term',
            ignore: 'mock ignorable property'
          }
        }
      }, {}).then(function (result) {
        assert.equal(typeof result, 'object', 'result is object')
        assert.notEqual(result, null, 'result is not null')
        assert.equal(Object.keys(result).length, 13, 'result has 13 properties')
        assert.ok(result.time > time, 'result.time seems correct')
        assert.equal(result.device_id, 'mock device id', 'result.device_id is correct')
        assert.equal(result.flow_id, 'mock flow id', 'result.flow_id is correct')
        assert.ok(result.flow_time > 0, 'result.flow_time is greater than zero')
        assert.ok(result.flow_time < time, 'result.flow_time is less than the current time')
        assert.equal(result.flowBeginTime, time, 'result.flowBeginTime is correct')
        assert.equal(result.flowCompleteSignal, 'mock flow complete signal', 'result.flowCompleteSignal is correct')
        assert.equal(result.flowType, 'mock flow type', 'result.flowType is correct')
        assert.equal(result.service, 'mock service', 'result.service is correct')
        assert.equal(result.utm_campaign, 'mock utm_campaign', 'result.utm_campaign is correct')
        assert.equal(result.utm_content, 'mock utm_content', 'result.utm_content is correct')
        assert.equal(result.utm_medium, 'mock utm_medium', 'result.utm_medium is correct')
        assert.equal(result.utm_source, 'mock utm_source', 'result.utm_source is correct')
        assert.equal(result.utm_term, 'mock utm_term', 'result.utm_term is correct')

        assert.equal(cache.get.callCount, 0, 'cache.get was not called')
        assert.equal(log.error.callCount, 0, 'log.error was not called')
      })
    }
  )

  it(
    'metricsContext.gather with DNT header',
    () => {
      return metricsContext.gather.call({
        headers: {
          dnt: '1'
        },
        payload: {
          metricsContext: {
            deviceId: 'mock device id',
            flowId: 'mock flow id',
            flowBeginTime: Date.now(),
            flowCompleteSignal: 'mock flow complete signal',
            flowType: 'mock flow type',
            context: 'mock context',
            entrypoint: 'mock entry point',
            migration: 'mock migration',
            service: 'mock service',
            utmCampaign: 'mock utm_campaign',
            utmContent: 'mock utm_content',
            utmMedium: 'mock utm_medium',
            utmSource: 'mock utm_source',
            utmTerm: 'mock utm_term',
            ignore: 'mock ignorable property'
          }
        }
      }, {}).then(function (result) {
        assert.equal(Object.keys(result).length, 8, 'result has 8 properties')
        assert.equal(result.utm_campaign, undefined, 'result.utm_campaign is undefined')
        assert.equal(result.utm_content, undefined, 'result.utm_content is undefined')
        assert.equal(result.utm_medium, undefined, 'result.utm_medium is undefined')
        assert.equal(result.utm_source, undefined, 'result.utm_source is undefined')
        assert.equal(result.utm_term, undefined, 'result.utm_term is undefined')

        assert.equal(log.error.callCount, 0, 'log.error was not called')
      })
    }
  )

  it(
    'metricsContext.gather with bad flowBeginTime',
    () => {
      return metricsContext.gather.call({
        payload: {
          metricsContext: {
            flowBeginTime: Date.now() + 10000
          }
        }
      }, {}).then(function (result) {
        assert.equal(typeof result, 'object', 'result is object')
        assert.notEqual(result, null, 'result is not null')
        assert.strictEqual(result.flow_time, 0, 'result.time is zero')

        assert.equal(log.error.callCount, 0, 'log.error was not called')

      })
    }
  )

  it(
    'metricsContext.gather with token',
    () => {
      const time = Date.now() - 1
      const token = {
        uid: Array(64).fill('7').join(''),
        id: 'wibble'
      }
      results.get = P.resolve({
        deviceId: 'deviceId',
        flowId: 'flowId',
        flowBeginTime: time,
        flowCompleteSignal: 'flowCompleteSignal',
        flowType: 'flowType',
        service: null,
        utmCampaign: 'utmCampaign',
        utmContent: 'utmContent',
        utmMedium: 'utmMedium',
        utmSource: 'utmSource',
        utmTerm: 'utmTerm'
      })
      return metricsContext.gather.call({
        auth: {
          credentials: token
        }
      }, { service: 'do not clobber me' }).then(function (result) {
        assert.equal(cache.get.callCount, 1, 'cache.get was called once')
        assert.equal(cache.get.args[0].length, 1, 'cache.get was passed one argument')
        assert.equal(cache.get.args[0][0], hashToken(token), 'cache.get argument was correct')

        assert.equal(typeof result, 'object', 'result is object')
        assert.notEqual(result, null, 'result is not null')
        assert.equal(Object.keys(result).length, 13, 'result has 13 properties')
        assert.ok(result.time > time, 'result.time seems correct')
        assert.equal(result.device_id, 'deviceId', 'result.device_id is correct')
        assert.equal(result.flow_id, 'flowId', 'result.flow_id is correct')
        assert.ok(result.flow_time > 0, 'result.flow_time is greater than zero')
        assert.ok(result.flow_time < time, 'result.flow_time is less than the current time')
        assert.equal(result.flowBeginTime, time, 'result.flowBeginTime is correct')
        assert.equal(result.flowCompleteSignal, 'flowCompleteSignal', 'result.flowCompleteSignal is correct')
        assert.equal(result.flowType, 'flowType', 'result.flowType is correct')
        assert.equal(result.service, 'do not clobber me', 'result.service is correct')
        assert.equal(result.utm_campaign, 'utmCampaign', 'result.utm_campaign is correct')
        assert.equal(result.utm_content, 'utmContent', 'result.utm_content is correct')
        assert.equal(result.utm_medium, 'utmMedium', 'result.utm_medium is correct')
        assert.equal(result.utm_source, 'utmSource', 'result.utm_source is correct')
        assert.equal(result.utm_term, 'utmTerm', 'result.utm_term is correct')

        assert.equal(log.error.callCount, 0, 'log.error was not called')
      })
    }
  )

  it(
    'metricsContext.gather with fake token',
    () => {
      const time = Date.now() - 1
      const uid = Array(64).fill('7').join('')
      const id = 'wibble'
      results.get = P.resolve({
        flowId: 'flowId',
        flowBeginTime: time
      })
      return metricsContext.gather.call({
        payload: {
          uid: uid,
          code: id
        }
      }, {}).then(function (result) {
        assert.equal(cache.get.callCount, 1, 'cache.get was called once')
        assert.equal(cache.get.args[0].length, 1, 'cache.get was passed one argument')
        assert.deepEqual(cache.get.args[0][0], hashToken({ uid, id }), 'cache.get argument was correct')

        assert.equal(typeof result, 'object', 'result is object')
        assert.notEqual(result, null, 'result is not null')
        assert.equal(Object.keys(result).length, 12, 'result has 12 properties')
        assert.ok(result.time > time, 'result.time seems correct')
        assert.equal(result.flow_id, 'flowId', 'result.flow_id is correct')
        assert.ok(result.flow_time > 0, 'result.flow_time is greater than zero')
        assert.ok(result.flow_time < time, 'result.flow_time is less than the current time')

        assert.equal(log.error.callCount, 0, 'log.error was not called')
      })
    }
  )

  it(
    'metricsContext.gather with bad token',
    () => {
      return metricsContext.gather.call({
        auth: {
          credentials: {
            uid: Array(64).fill('c').join('')
          }
        }
      }, {}).then(function (result) {
        assert.equal(typeof result, 'object', 'result is object')
        assert.notEqual(result, null, 'result is not null')
        assert.equal(Object.keys(result).length, 0, 'result is empty')

        assert.equal(log.error.callCount, 1, 'log.error was called once')
        assert.equal(log.error.args[0].length, 1, 'log.error was passed one argument')
        assert.equal(log.error.args[0][0].op, 'metricsContext.gather', 'op property was correct')
        assert.equal(log.error.args[0][0].err.message, 'Invalid token', 'err.message property was correct')
        assert.strictEqual(log.error.args[0][0].hasToken, true, 'hasToken property was correct')
        assert.strictEqual(log.error.args[0][0].hasId, false, 'hasId property was correct')
        assert.strictEqual(log.error.args[0][0].hasUid, true, 'hasUid property was correct')
      })
    }
  )

  it(
    'metricsContext.gather with no token',
    () => {
      results.get = P.resolve({
        flowId: 'flowId',
        flowBeginTime: Date.now()
      })
      return metricsContext.gather.call({
        auth: {}
      }, {}).then(function (result) {
        assert.equal(typeof result, 'object', 'result is object')
        assert.notEqual(result, null, 'result is not null')
        assert.equal(Object.keys(result).length, 0, 'result is empty')

        assert.equal(log.error.callCount, 0, 'log.error was not called')
      })
    }
  )

  it(
    'metricsContext.gather with metadata and token',
    () => {
      const time = Date.now() - 1
      results.get = P.resolve({
        deviceId: 'foo',
        flowId: 'bar',
        flowBeginTime: time - 1
      })
      return metricsContext.gather.call({
        auth: {
          credentials: {
            uid: Array(16).fill('f').join(''),
            id: 'baz'
          }
        },
        payload: {
          metricsContext: {
            deviceId: 'qux',
            flowId: 'wibble',
            flowBeginTime: time
          }
        }
      }, {}).then(function (result) {
        assert.equal(typeof result, 'object', 'result is object')
        assert.notEqual(result, null, 'result is not null')
        assert.equal(result.device_id, 'qux', 'result.device_id is correct')
        assert.equal(result.flow_id, 'wibble', 'result.flow_id is correct')

        assert.equal(cache.get.callCount, 0, 'cache.get was not called')
        assert.equal(log.error.callCount, 0, 'log.error was not called')
      })
    }
  )

  it(
    'metricsContext.gather with get error',
    () => {
      results.get = P.reject('foo')
      return metricsContext.gather.call({
        auth: {
          credentials: {
            uid: Array(16).fill('f').join(''),
            id: 'bar'
          }
        }
      }, {}).then(function () {
        assert.equal(log.error.callCount, 1, 'log.error was called once')
        assert.equal(log.error.args[0].length, 1, 'log.error was passed one argument')
        assert.equal(log.error.args[0][0].op, 'metricsContext.gather', 'argument op property was correct')
        assert.equal(log.error.args[0][0].err, 'foo', 'argument err property was correct')

        assert.equal(cache.get.callCount, 1, 'cache.get was called once')
      })
    }
  )

  it(
    'metricsContext.clear with token',
    () => {
      const token = {
        uid: Array(64).fill('7').join(''),
        id: 'wibble'
      }
      return metricsContext.clear.call({
        auth: {
          credentials: token
        }
      }).then(() => {
        assert.equal(cache.del.callCount, 1, 'cache.del was called once')
        assert.equal(cache.del.args[0].length, 1, 'cache.del was passed one argument')
        assert.equal(cache.del.args[0][0], hashToken(token), 'cache.del argument was correct')
      })
    }
  )

  it(
    'metricsContext.clear with fake token',
    () => {
      const uid = Array(64).fill('6').join('')
      const id = 'blee'
      return metricsContext.clear.call({
        payload: {
          uid: uid,
          code: id
        }
      }).then(() => {
        assert.equal(cache.del.callCount, 1, 'cache.del was called once')
        assert.equal(cache.del.args[0].length, 1, 'cache.del was passed one argument')
        assert.deepEqual(cache.del.args[0][0], hashToken({ uid, id }), 'cache.del argument was correct')
      })
    }
  )

  it(
    'metricsContext.clear with no token',
    () => {
      return metricsContext.clear.call({}).then(() => {
        assert.equal(cache.del.callCount, 0, 'cache.del was not called')
        assert.equal(log.error.callCount, 0, 'log.error was not called')
      }).catch(err => assert.fail(err))
    }
  )

  it(
    'metricsContext.clear with memcached error',
    () => {
      const token = {
        uid: Array(64).fill('7').join(''),
        id: 'wibble'
      }
      results.del = P.reject(new Error('blee'))
      return metricsContext.clear.call({
        auth: {
          credentials: token
        }
      })
      .then(() => assert.fail('call to metricsContext.clear should have failed'))
      .catch(err => {
        assert.equal(err.message, 'blee', 'metricsContext.clear should have rejected with memcached error')
        assert.equal(cache.del.callCount, 1, 'cache.del was called once')
      })
    }
  )

  it(
    'metricsContext.validate with valid data',
    () => {
      const flowBeginTime = 1451566800000
      const flowId = '1234567890abcdef1234567890abcdef6a7c0469a1e3d6dfa7d9bed7ae209672'
      sinon.stub(Date, 'now', function() {
        return flowBeginTime + 59999
      })
      const mockLog = mocks.mockLog()
      const mockConfig = {
        memcached: {},
        metrics: {
          flow_id_expiry: 60000,
          flow_id_key: 'S3CR37'
        }
      }
      const mockRequest = {
        headers: {
          'user-agent': 'test-agent'
        },
        payload: {
          metricsContext: {
            flowId,
            flowBeginTime
          }
        }
      }

      const metricsContext = require(modulePath)(mockLog, mockConfig)
      const result = metricsContext.validate.call(mockRequest)

      assert.strictEqual(result, true, 'result was true')
      assert.equal(mockRequest.payload.metricsContext.flowId, '1234567890abcdef1234567890abcdef6a7c0469a1e3d6dfa7d9bed7ae209672', 'valid flow data was not removed')
      assert.equal(mockLog.warn.callCount, 0, 'log.warn was not called')
      assert.equal(mockLog.info.callCount, 1, 'log.info was called once')
      assert.equal(mockLog.info.args[0].length, 1, 'log.info was passed one argument')
      assert.deepEqual(mockLog.info.args[0][0], {
        op: 'metrics.context.validate',
        valid: true,
        agent: 'test-agent'
      }, 'log.info was passed correct argument')

      Date.now.restore()
    }
  )

  it(
    'metricsContext.validate with missing payload',
    () => {
      var mockLog = mocks.mockLog()
      var mockConfig = {
        memcached: {},
        metrics: {
          flow_id_expiry: 60000,
          flow_id_key: 'test'
        }
      }
      var mockRequest = {
        headers: {
          'user-agent': 'test-agent'
        }
      }

      var metricsContext = require('../../../lib/metrics/context')(mockLog, mockConfig)
      var valid = metricsContext.validate.call(mockRequest)

      assert(! valid, 'the data is treated as invalid')
      assert.equal(mockLog.info.callCount, 0, 'log.info was not called')
      assert.equal(mockLog.warn.callCount, 1, 'log.warn was called once')
      assert.ok(mockLog.warn.calledWithExactly({
        op: 'metrics.context.validate',
        valid: false,
        reason: 'missing payload',
        agent: 'test-agent'
      }), 'log.warn was called with the expected log data')
    }
  )

  it(
    'metricsContext.validate with missing data bundle',
    () => {
      var mockLog = mocks.mockLog()
      var mockConfig = {
        memcached: {},
        metrics: {
          flow_id_expiry: 60000,
          flow_id_key: 'test'
        }
      }
      var mockRequest = {
        headers: {
          'user-agent': 'test-agent'
        },
        payload: {
          email: 'test@example.com'
          // note that 'metricsContext' key is absent
        }
      }

      var metricsContext = require(modulePath)(mockLog, mockConfig)
      var valid = metricsContext.validate.call(mockRequest)

      assert(! valid, 'the data is treated as invalid')
      assert.equal(mockLog.info.callCount, 0, 'log.info was not called')
      assert.equal(mockLog.warn.callCount, 1, 'log.warn was called once')
      assert.ok(mockLog.warn.calledWithExactly({
        op: 'metrics.context.validate',
        valid: false,
        reason: 'missing context',
        agent: 'test-agent'
      }), 'log.warn was called with the expected log data')
    }
  )

  it(
    'metricsContext.validate with missing flowId',
    () => {
      var mockLog = mocks.mockLog()
      var mockConfig = {
        memcached: {},
        metrics: {
          flow_id_expiry: 60000,
          flow_id_key: 'test'
        }
      }
      var mockRequest = {
        headers: {
          'user-agent': 'test-agent'
        },
        payload: {
          metricsContext: {
            flowBeginTime: Date.now() - 1
          }
        }
      }

      var metricsContext = require(modulePath)(mockLog, mockConfig)
      var valid = metricsContext.validate.call(mockRequest)

      assert(! valid, 'the data is treated as invalid')
      assert(! mockRequest.payload.metricsContext.flowBeginTime, 'the invalid flow data was removed')
      assert.equal(mockLog.info.callCount, 0, 'log.info was not called')
      assert.equal(mockLog.warn.callCount, 1, 'log.warn was called once')
      assert.ok(mockLog.warn.calledWithExactly({
        op: 'metrics.context.validate',
        valid: false,
        reason: 'missing flowId',
        agent: 'test-agent'
      }), 'log.warn was called with the expected log data')
    }
  )

  it(
    'metricsContext.validate with missing flowBeginTime',
    () => {
      var mockLog = mocks.mockLog()
      var mockConfig = {
        memcached: {},
        metrics: {
          flow_id_expiry: 60000,
          flow_id_key: 'test'
        }
      }
      var mockRequest = {
        headers: {
          'user-agent': 'test-agent'
        },
        payload: {
          metricsContext: {
            flowId: 'f1031df1031df1031df1031df1031df1031df1031df1031df1031df1031df103'
          }
        }
      }

      var metricsContext = require(modulePath)(mockLog, mockConfig)
      var valid = metricsContext.validate.call(mockRequest)

      assert(! valid, 'the data is treated as invalid')
      assert(! mockRequest.payload.metricsContext.flowId, 'the invalid flow data was removed')
      assert.equal(mockLog.info.callCount, 0, 'log.info was not called')
      assert.equal(mockLog.warn.callCount, 1, 'log.warn was called once')
      assert.ok(mockLog.warn.calledWithExactly({
        op: 'metrics.context.validate',
        valid: false,
        reason: 'missing flowBeginTime',
        agent: 'test-agent'
      }), 'log.warn was called with the expected log data')
    }
  )

  it(
    'metricsContext.validate with flowBeginTime that is too old',
    () => {
      var mockLog = mocks.mockLog()
      var mockConfig = {
        memcached: {},
        metrics: {
          flow_id_expiry: 60000,
          flow_id_key: 'test'
        }
      }
      var mockRequest = {
        headers: {
          'user-agent': 'test-agent'
        },
        payload: {
          metricsContext: {
            flowId: 'f1031df1031df1031df1031df1031df1031df1031df1031df1031df1031df103',
            flowBeginTime: Date.now() - mockConfig.metrics.flow_id_expiry - 1
          }
        }
      }

      var metricsContext = require(modulePath)(mockLog, mockConfig)
      var valid = metricsContext.validate.call(mockRequest)

      assert(! valid, 'the data is treated as invalid')
      assert(! mockRequest.payload.metricsContext.flowId, 'the invalid flow data was removed')
      assert.equal(mockLog.info.callCount, 0, 'log.info was not called')
      assert.equal(mockLog.warn.callCount, 1, 'log.warn was called once')
      assert.ok(mockLog.warn.calledWithExactly({
        op: 'metrics.context.validate',
        valid: false,
        reason: 'expired flowBeginTime',
        agent: 'test-agent'
      }), 'log.warn was called with the expected log data')
    }
  )

  it(
    'metricsContext.validate with an invalid flow signature',
    () => {
      var mockLog = mocks.mockLog()
      var mockConfig = {
        memcached: {},
        metrics: {
          flow_id_expiry: 60000,
          flow_id_key: 'test'
        }
      }
      var mockRequest = {
        headers: {
          'user-agent': 'test-agent'
        },
        payload: {
          metricsContext: {
            flowId: 'f1031df1031df1031df1031df1031df1031df1031df1031df1031df1031df103',
            flowBeginTime: Date.now() - 1
          }
        }
      }

      var metricsContext = require(modulePath)(mockLog, mockConfig)
      var valid = metricsContext.validate.call(mockRequest)

      assert(! valid, 'the data is treated as invalid')
      assert(! mockRequest.payload.metricsContext.flowId, 'the invalid flow data was removed')
      assert.equal(mockLog.info.callCount, 0, 'log.info was not called')
      assert.equal(mockLog.warn.callCount, 1, 'log.warn was called once')
      assert.ok(mockLog.warn.calledWithExactly({
        op: 'metrics.context.validate',
        valid: false,
        reason: 'invalid signature',
        agent: 'test-agent'
      }), 'log.warn was called with the expected log data')
    }
  )

  it(
    'metricsContext.validate with flow signature from different key',
    () => {
      var expectedTime = 1451566800000
      var expectedSalt = '4d6f7a696c6c6146697265666f782121'
      var expectedHmac = 'c89d56556d22039fbbf54d34e0baf206'
      var mockLog = mocks.mockLog()
      var mockConfig = {
        memcached: {},
        metrics: {
          flow_id_expiry: 60000,
          flow_id_key: 'ThisIsTheWrongKey'
        }
      }
      var mockRequest = {
        headers: {
          'user-agent': 'Firefox'
        },
        payload: {
          metricsContext: {
            flowId: expectedSalt + expectedHmac,
            flowBeginTime: expectedTime
          }
        }
      }
      sinon.stub(Date, 'now', function() {
        return expectedTime + 20000
      })

      try {
        var metricsContext = require(modulePath)(mockLog, mockConfig)
        var valid = metricsContext.validate.call(mockRequest)
      } finally {
        Date.now.restore()
      }

      assert(! valid, 'the data is treated as invalid')
      assert(! mockRequest.payload.metricsContext.flowId, 'the invalid flow data was removed')
      assert.equal(mockLog.info.callCount, 0, 'log.info was not called')
      assert.equal(mockLog.warn.callCount, 1, 'log.warn was called once')
      assert.ok(mockLog.warn.calledWithExactly({
        op: 'metrics.context.validate',
        valid: false,
        reason: 'invalid signature',
        agent: 'Firefox'
      }), 'log.warn was called with the expected log data')
    }
  )

  it(
    'metricsContext.validate with flow signature from different timestamp',
    () => {
      var expectedTime = 1451566800000
      var expectedSalt = '4d6f7a696c6c6146697265666f782121'
      var expectedHmac = 'c89d56556d22039fbbf54d34e0baf206'
      var mockLog = mocks.mockLog()
      var mockConfig = {
        memcached: {},
        metrics: {
          flow_id_expiry: 60000,
          flow_id_key: 'S3CR37'
        }
      }
      var mockRequest = {
        headers: {
          'user-agent': 'Firefox'
        },
        payload: {
          metricsContext: {
            flowId: expectedSalt + expectedHmac,
            flowBeginTime: expectedTime - 1
          }
        }
      }
      sinon.stub(Date, 'now', function() {
        return expectedTime + 20000
      })

      try {
        var metricsContext = require(modulePath)(mockLog, mockConfig)
        var valid = metricsContext.validate.call(mockRequest)
      } finally {
        Date.now.restore()
      }

      assert(! valid, 'the data is treated as invalid')
      assert(! mockRequest.payload.metricsContext.flowId, 'the invalid flow data was removed')
      assert.equal(mockLog.info.callCount, 0, 'log.info was not called')
      assert.equal(mockLog.warn.callCount, 1, 'log.warn was called once')
      assert.ok(mockLog.warn.calledWithExactly({
        op: 'metrics.context.validate',
        valid: false,
        reason: 'invalid signature',
        agent: 'Firefox'
      }), 'log.warn was called with the expected log data')
    }
  )

  it(
    'metricsContext.validate with flow signature from different user agent',
    () => {
      var expectedTime = 1451566800000
      var expectedSalt = '4d6f7a696c6c6146697265666f782121'
      var expectedHmac = 'c89d56556d22039fbbf54d34e0baf206'
      var mockLog = mocks.mockLog()
      var mockConfig = {
        memcached: {},
        metrics: {
          flow_id_expiry: 60000,
          flow_id_key: 'S3CR37'
        }
      }
      var mockRequest = {
        headers: {
          'user-agent': 'ThisIsNotFirefox'
        },
        payload: {
          metricsContext: {
            flowId: expectedSalt + expectedHmac,
            flowBeginTime: expectedTime
          }
        }
      }
      sinon.stub(Date, 'now', function() {
        return expectedTime + 20000
      })

      try {
        var metricsContext = require(modulePath)(mockLog, mockConfig)
        var valid = metricsContext.validate.call(mockRequest)
      } finally {
        Date.now.restore()
      }

      assert(! valid, 'the data is treated as invalid')
      assert(! mockRequest.payload.metricsContext.flowId, 'the invalid flow data was removed')
      assert.equal(mockLog.info.callCount, 0, 'log.info was not called')
      assert.equal(mockLog.warn.callCount, 1, 'log.warn was called once')
      assert.ok(mockLog.warn.calledWithExactly({
        op: 'metrics.context.validate',
        valid: false,
        reason: 'invalid signature',
        agent: 'ThisIsNotFirefox'
      }), 'log.warn was called with the expected log data')
    }
  )

  it('metricsContext.validate with flow signature compared without user agent', () => {
    const flowBeginTime = 1451566800000
    const flowId = '1234567890abcdef1234567890abcdef06146f1d05e7ae215885a4e45b66ff1f'
    sinon.stub(Date, 'now', () => flowBeginTime + 59999)
    const mockLog = mocks.mockLog()
    const mockConfig = {
      memcached: {},
      metrics: {
        flow_id_expiry: 60000,
        flow_id_key: 'S3CR37'
      }
    }
    const mockRequest = {
      headers: {
        'user-agent': 'some other user agent'
      },
      payload: {
        metricsContext: {
          flowId,
          flowBeginTime
        }
      }
    }

    const metricsContext = require(modulePath)(mockLog, mockConfig)
    const result = metricsContext.validate.call(mockRequest)

    assert.strictEqual(result, true, 'validate returned true')
    assert.equal(mockRequest.payload.metricsContext.flowId, '1234567890abcdef1234567890abcdef06146f1d05e7ae215885a4e45b66ff1f', 'valid flow data was not removed')
    assert.equal(mockLog.warn.callCount, 0, 'log.warn was not called')
    assert.equal(mockLog.info.callCount, 1, 'log.info was called once')

    Date.now.restore()
  })

  it(
    'setFlowCompleteSignal',
    () => {
      const request = {
        payload: {
          metricsContext: {}
        }
      }
      metricsContext.setFlowCompleteSignal.call(request, 'wibble', 'blee')
      assert.deepEqual(request.payload.metricsContext, {
        flowCompleteSignal: 'wibble',
        flowType: 'blee'
      }, 'flowCompleteSignal and flowType were set correctly')
    }
  )

  it(
    'setFlowCompleteSignal without metricsContext',
    () => {
      const request = {
        payload: {}
      }
      metricsContext.setFlowCompleteSignal.call(request, 'wibble', 'blee')
      assert.deepEqual(request.payload, {}, 'flowCompleteSignal and flowType were not set')
    }
  )

})
