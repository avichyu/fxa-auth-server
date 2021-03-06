/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// This module exports a safe URL-builder interface, ensuring that no
// unsafe input can leak into generated URLs.
//
// It takes the approach of throwing error.unexpectedError() when unsafe
// input is encountered, for extra visibility. An alternative approach
// would be to use encodeURIComponent instead to convert unsafe input on
// the fly. However, we have no valid use case for encoding weird data
// like that, since we explicitly hex-encode params that need it. So if
// any weird input is encountered, we should fail the request as soon as
// possible.
//
// Usage:
//
//   const SafeUrl = require('./safe-url')(log)
//
//   const url = new SafeUrl('/account/:uid/sessions', 'db.sessions')
//   url.render({ uid: 'foo' })            // returns '/account/foo/sessions'
//   url.render({ uid: 'bar' })            // returns '/account/bar/sessions'
//   url.render({ uid: 'foo\n' })          // throws error.unexpectedError()
//   url.render({})                        // throws error.unexpectedError()
//   url.render({ uid: 'foo', id: 'bar' }) // throws error.unexpectedError()

'use strict'

const error = require('./error')
const impl = require('safe-url-assembler')()

const SAFE_PATH_COMPONENT = /^[\w.]+$/

module.exports = log => class SafeUrl {
  constructor (path, caller) {
    const expectedKeys = path.split('/')
      .filter(part => part.indexOf(':') === 0)
      .map(part => part.substr(1))

    this._expectedKeys = {
      array: expectedKeys,
      set: new Set(expectedKeys)
    }
    this._template = impl.template(path)
    this._caller = caller
  }

  render (params = {}) {
    const keys = Object.keys(params)
    const { array: expected, set: expectedSet } = this._expectedKeys

    if (keys.length !== expected.length) {
      this._fail('safeUrl.mismatch', { keys, expected })
    }

    keys.forEach(key => {
      if (! expectedSet.has(key)) {
        this._fail('safeUrl.unexpected', { key, expected })
      }

      const value = params[key]

      if (! value || typeof value !== 'string') {
        this._fail('safeUrl.bad', { key, value })
      }

      if (! SAFE_PATH_COMPONENT.test(value)) {
        this._fail('safeUrl.unsafe', { key, value })
      }
    })

    return this._template.param(params).toString()
  }

  _fail (op, data) {
    log.error(Object.assign({ op, caller: this._caller }, data))
    throw error.unexpectedError()
  }
}
