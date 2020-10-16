'use strict'

const { assert } = require('chai')
const path = require('path')
const {
  rmdirSync,
  mkdirSync
} = require('fs')

const Fac = require('../')
const caller = { ctx: { root: __dirname } }
const dbDir = path.join(__dirname, 'db')

describe('Base workers', () => {
  before(() => {
    rmdirSync(dbDir, { recursive: true })
    mkdirSync(dbDir, { recursive: true })
  })

  after(() => {
    rmdirSync(dbDir, { recursive: true })
  })

  it('Setup step', (done) => {
    const fac = new Fac(caller, {})

    fac.start((err) => {
      assert.ifError(err)
      assert.isOk(fac._workers.size >= 1)

      fac.stop((err) => {
        assert.ifError(err)
        assert.isOk(fac._workers.size === 0)

        done()
      })
    })
  })
})
