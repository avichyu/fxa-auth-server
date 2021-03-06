/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict'

const assert = require('insist')
const mocks = require('../mocks')
const sinon = require('sinon')
const proxyquire = require('proxyquire')

const ROOT_DIR = '../..'

describe('Pool', () => {

  let log, SafeUrl, Pool, poolee

  beforeEach(() => {
    log = mocks.mockLog()
    SafeUrl = require(`${ROOT_DIR}/lib/safe-url`)(log)
    poolee = sinon.createStubInstance(require('poolee'))
    Pool = proxyquire(`${ROOT_DIR}/lib/pool`, {
      poolee: function () {
        return poolee
      }
    })
  })

  it(
    'pool.request with default options',
    () => {
      var pool = new Pool('http://example.com/ignore/me')
      pool.request(null, new SafeUrl(''))

      assert.equal(poolee.request.callCount, 1, 'poolee.request was called once')

      var args = poolee.request.getCall(0).args
      assert.equal(args.length, 2, 'poolee.request was passed two arguments')

      var options = args[0]
      assert.equal(typeof options, 'object', 'options is object')
      assert.equal(Object.keys(options).length, 4, 'options has 4 properties')
      assert.equal(options.method, 'GET', 'options.method is GET')
      assert.equal(options.path, '', 'options.path is blank')
      assert.equal(typeof options.headers, 'object', 'options.headers is object')
      assert.equal(Object.keys(options.headers).length, 1, 'options.headers has 1 property')
      assert.equal(options.headers['Content-Type'], 'application/json', 'Content-Type header is application/json')
      assert.equal(options.data, undefined, 'options.data is undefined')

      var callback = args[1]
      assert.equal(typeof callback, 'function', 'callback is function')
    }
  )

  it(
    'pool.request with alternative options',
    () => {
      var pool = new Pool('http://example.com/')
      pool.request('POST', new SafeUrl('/:foo'), { foo: 'bar' }, { baz: 'qux' })

      assert.equal(poolee.request.callCount, 1, 'poolee.request was called once')

      var args = poolee.request.getCall(0).args
      assert.equal(args.length, 2, 'poolee.request was passed two arguments')

      var options = args[0]
      assert.equal(typeof options, 'object', 'options is object')
      assert.equal(Object.keys(options).length, 4, 'options has 4 properties')
      assert.equal(options.method, 'POST', 'options.method is POST')
      assert.equal(options.path, '/bar', 'options.path is /bar')
      assert.equal(typeof options.headers, 'object', 'options.headers is object')
      assert.equal(Object.keys(options.headers).length, 1, 'options.headers has 1 property')
      assert.equal(options.headers['Content-Type'], 'application/json', 'Content-Type header is application/json')
      assert.equal(options.data, '{"baz":"qux"}', 'options.data is correct')

      var callback = args[1]
      assert.equal(typeof callback, 'function', 'callback is function')
    }
  )

  it('pool.request with string path', () => {
    const pool = new Pool('http://example.com/')
    pool.request(null, '/foo')
      .then(
        () => assert(false, 'request should have failed'),
        err => assert(err instanceof Error)
      )
  })

  it('pool.request with missing param', () => {
    const pool = new Pool('http://example.com/')
    pool.request(null, new SafeUrl('/:foo'), {})
      .then(
        () => assert(false, 'request should have failed'),
        err => assert(err instanceof Error)
      )
  })

  it(
    'pool.request callback with error',
    () => {
      var pool = new Pool('http://example.com/')
      const p = pool.request(null, new SafeUrl(''))
        .then(function () {
          assert(false, 'request should have failed')
        }, function (error) {
          assert.equal(typeof error, 'string', 'error is string')
          assert.equal(error, 'foo', 'error is correct')
        })

      var args = poolee.request.getCall(0).args
      var callback = args[1]
      callback('foo')
      return p
    }
  )

  it(
    'pool.request callback with HTTP error response',
    () => {
      var pool = new Pool('http://example.com/')
      const p = pool.request(null, new SafeUrl(''))
        .then(function () {
          assert(false, 'request should have failed')
        }, function (error) {
          assert.ok(error instanceof Error, 'error is Error instance')
          assert.equal(error.statusCode, 404, 'error.statusCode is 404')
          assert.equal(error.message, 'wibble', 'error.message is correct')
        })

      var args = poolee.request.getCall(0).args
      var callback = args[1]
      callback(null, { statusCode: 404 }, 'wibble')
      return p
    }
  )

  it(
    'pool.request callback with HTTP error response and JSON body',
    () => {
      var pool = new Pool('http://example.com/')
      const p = pool.request(null, new SafeUrl(''))
        .then(function () {
          assert(false, 'request should have failed')
        }, function (error) {
          assert.equal(error instanceof Error, true, 'error is an Error instance')
          assert.equal(Object.keys(error).length, 2, 'error has two properties')
          assert.equal(error.statusCode, 418, 'error.statusCode is 418')
          assert.equal(error.foo, 'bar', 'other error data is correct')
        })

      var args = poolee.request.getCall(0).args
      var callback = args[1]
      callback(null, { statusCode: 418 }, '{"foo":"bar"}')
      return p
    }
  )

  it(
    'pool.request callback with HTTP success response and empty body',
    () => {
      var pool = new Pool('http://example.com/')
      const p = pool.request(null, new SafeUrl(''))
        .then(function (result) {
          assert.equal(result, undefined, 'result is undefined')
        })

      var args = poolee.request.getCall(0).args
      var callback = args[1]
      callback(null, { statusCode: 200 }, '')
      return p
    }
  )

  it(
    'pool.request callback with HTTP success response and valid JSON body',
    () => {
      var pool = new Pool('http://example.com/')
      const p = pool.request(null, new SafeUrl(''))
        .then(function (result) {
          assert.equal(typeof result, 'object', 'result is object')
          assert.equal(Object.keys(result).length, 1, 'result has 1 property')
          assert.equal(result.foo, 'bar', 'result data is correct')
        })

      var args = poolee.request.getCall(0).args
      var callback = args[1]
      callback(null, { statusCode: 200 }, '{"foo":"bar"}')
      return p
    }
  )

  it(
    'pool.request callback with HTTP success response and invalid JSON body',
    () => {
      var pool = new Pool('http://example.com/')
      const p = pool.request(null, new SafeUrl(''))
        .then(function () {
          assert(false, 'request should have failed')
        }, function (error) {
          assert.ok(error instanceof Error, 'error is Error instance')
          assert.equal(error.statusCode, undefined, 'error.statusCode is undefined')
          assert.equal(error.message, 'Invalid JSON', 'error.message is correct')
        })

      var args = poolee.request.getCall(0).args
      var callback = args[1]
      callback(null, { statusCode: 200 }, 'foo')
      return p
    }
  )

  it(
    'pool.get',
    () => {
      var pool = new Pool('http://example.com/')
      sinon.stub(pool, 'request', function () {})
      pool.get('foo', 'bar')

      assert.equal(pool.request.callCount, 1, 'pool.request was called once')

      var args = pool.request.getCall(0).args
      assert.equal(args.length, 3, 'pool.request was passed three arguments')
      assert.equal(args[0], 'GET', 'first argument to pool.request was GET')
      assert.equal(args[1], 'foo', 'second argument to pool.request was correct')
      assert.equal(args[2], 'bar', 'third argument to pool.request was correct')
    }
  )

  it(
    'pool.put',
    () => {
      var pool = new Pool('http://example.com/')
      sinon.stub(pool, 'request', function () {})
      pool.put('baz', 'qux', 'wibble')

      assert.equal(pool.request.callCount, 1, 'pool.request was called once')

      var args = pool.request.getCall(0).args
      assert.equal(args.length, 4, 'pool.request was passed four arguments')
      assert.equal(args[0], 'PUT', 'first argument to pool.request was PUT')
      assert.equal(args[1], 'baz', 'second argument to pool.request was correct')
      assert.equal(args[2], 'qux', 'third argument to pool.request was correct')
      assert.equal(args[3], 'wibble', 'fourth argument to pool.request was correct')
    }
  )

  it(
    'pool.post',
    () => {
      var pool = new Pool('http://example.com/')
      sinon.stub(pool, 'request', function () {})
      pool.post('foo', 'bar', 'baz')

      assert.equal(pool.request.callCount, 1, 'pool.request was called once')

      var args = pool.request.getCall(0).args
      assert.equal(args.length, 4, 'pool.request was passed four arguments')
      assert.equal(args[0], 'POST', 'first argument to pool.request was POST')
      assert.equal(args[1], 'foo', 'second argument to pool.request was correct')
      assert.equal(args[2], 'bar', 'third argument to pool.request was correct')
      assert.equal(args[3], 'baz', 'fourth argument to pool.request was correct')
    }
  )

  it(
    'pool.del',
    () => {
      var pool = new Pool('http://example.com/')
      sinon.stub(pool, 'request', function () {})
      pool.del('foo', 'bar', 'baz')

      assert.equal(pool.request.callCount, 1, 'pool.request was called once')

      var args = pool.request.getCall(0).args
      assert.equal(args.length, 4, 'pool.request was passed four arguments')
      assert.equal(args[0], 'DELETE', 'first argument to pool.request was POST')
      assert.equal(args[1], 'foo', 'second argument to pool.request was correct')
      assert.equal(args[2], 'bar', 'second argument was correct')
      assert.equal(args[3], 'baz', 'third argument was correct')
    }
  )


})
