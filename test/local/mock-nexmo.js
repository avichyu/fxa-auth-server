/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict'

const assert = require('insist')
const MockNexmo = require('../../lib/mock-nexmo')
const sinon = require('sinon')
const config = require('../../config').getProperties()

describe('mock-nexmo', () => {
  let log
  let mockNexmo

  before(() => {
    log = {
      info: sinon.spy()
    }
    mockNexmo = new MockNexmo(log, config)
  })

  afterEach(() => {
    log.info.reset()
  })

  it('constructor creates an instance', () => {
    assert.ok(mockNexmo)
  })

  describe('message.sendSms', () => {
    it('returns status: 0 with options, callback', (done) => {
      mockNexmo.message.sendSms('senderid', '+019999999999', 'message', {}, (err, resp) => {
        assert.strictEqual(err, null)
        assert.equal(resp.messages.length, 1)
        assert.strictEqual(resp.messages[0].status, '0')
        assert.equal(log.info.callCount, 1)

        done()
      })
    })

    it('returns status: 0 without options, only callback', (done) => {
      mockNexmo.message.sendSms('senderid', '+019999999999', 'message', (err, resp) => {
        assert.strictEqual(err, null)
        assert.equal(resp.messages.length, 1)
        assert.strictEqual(resp.messages[0].status, '0')
        assert.equal(log.info.callCount, 1)

        done()
      })
    })
  })
})
