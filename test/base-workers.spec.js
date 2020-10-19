'use strict'

const { assert } = require('chai')
const path = require('path')
const {
  rmdirSync,
  mkdirSync
} = require('fs')

const {
  getTableCreationQuery,
  getTableDeletionQuery
} = require('./helpers')

const DB_WORKER_ACTIONS = require(
  '../worker/db-worker-actions/db-worker-actions.const'
)
const Fac = require('../')
const caller = { ctx: { root: __dirname } }
const dbDir = path.join(__dirname, 'db')

const tableModel = [
  'table1',
  {
    id: 'INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT',
    number: 'INTEGER',
    text: 'VARCHAR(255)'
  }
]

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

  describe('Query', () => {
    let fac

    before((done) => {
      fac = new Fac(caller, {})
      fac.start(done)
    })

    after((done) => {
      fac.stop(done)
    })

    it('Enable WAL journal mode in PRAGMA', async () => {
      const res = await fac.asyncQuery({
        action: DB_WORKER_ACTIONS.EXEC_PRAGMA,
        sql: 'journal_mode = WAL'
      })

      assert.strictEqual(res, 'wal')

      fac.initializeWalCheckpointRestart(1000)
      await new Promise((resolve) => setTimeout(resolve, 1000))
    })

    it('Create table via run-action', async () => {
      await fac.asyncQuery({
        action: DB_WORKER_ACTIONS.RUN,
        sql: getTableCreationQuery(tableModel)
      })

      await fac.asyncQuery({
        action: DB_WORKER_ACTIONS.RUN,
        sql: getTableDeletionQuery(tableModel)
      })
    })
  })
})
