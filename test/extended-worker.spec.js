'use strict'

const { assert } = require('chai')
const path = require('path')
const {
  mkdirSync
} = require('fs')

const {
  getTableCreationQuery,
  getTableDeletionQuery,
  rmRfSync
} = require('./helpers')

const BASE_DB_WORKER_ACTIONS = require(
  '../worker/db-worker-actions/db-worker-actions.const'
)
const DB_WORKER_ACTIONS = require(
  './extended-worker/db-worker-actions/db-worker-actions.const'
)
const Fac = require('..')
const caller = { ctx: { root: __dirname } }
const dbPathAbsolute = path.join(__dirname, 'db')
const workerPathAbsolute = path
  .join(__dirname, 'extended-worker', 'index.js')

const tableModel = [
  'table1',
  {
    id: 'INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT',
    number: 'INTEGER',
    text: 'VARCHAR(255)'
  }
]
const tableData = [
  { number: 11, text: 'test-11' },
  { number: 12, text: 'test-12' },
  { number: 13, text: 'test-13' },
  { number: 14, text: 'test-14' },
  { number: 15, text: 'test-15' }
]

describe('Extended worker', () => {
  before(() => {
    rmRfSync(dbPathAbsolute)
    mkdirSync(dbPathAbsolute, { recursive: true })
  })

  after(() => {
    rmRfSync(dbPathAbsolute)
  })

  it('Setup step', (done) => {
    const fac = new Fac(
      caller,
      { dbPathAbsolute, workerPathAbsolute }
    )

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
      fac = new Fac(
        caller,
        { dbPathAbsolute, workerPathAbsolute }
      )
      fac.start(done)
    })

    after((done) => {
      fac.stop(done)
    })

    it('Throw error if action is not found', async () => {
      try {
        await fac.asyncQuery({
          action: 'NON_EXISTENT_ACTION',
          sql: getTableCreationQuery(tableModel)
        })
      } catch (err) {
        assert.throws(
          () => { throw err },
          'ERR_ACTION_HAS_NOT_BEEN_FOUND'
        )
      }
    })

    it('Throw error if action is not passed', async () => {
      try {
        await fac.asyncQuery({
          action: undefined,
          sql: getTableCreationQuery(tableModel)
        })
      } catch (err) {
        assert.throws(
          () => { throw err },
          'ERR_ACTION_HAS_NOT_BEEN_PASSED'
        )
      }
    })

    it('Enable WAL journal mode in PRAGMA', async () => {
      const res = await fac.asyncQuery({
        action: BASE_DB_WORKER_ACTIONS.EXEC_PRAGMA,
        sql: 'journal_mode = WAL'
      })

      assert.strictEqual(res, 'wal')

      fac.initializeWalCheckpointRestart(1000)
      await new Promise((resolve) => setTimeout(resolve, 1000))
    })

    it('Create table via run-in-trans-action', async () => {
      await fac.asyncQuery({
        action: DB_WORKER_ACTIONS.RUN_IN_TRANS,
        sql: getTableCreationQuery(tableModel)
      })

      await fac.asyncQuery({
        action: DB_WORKER_ACTIONS.RUN_IN_TRANS,
        sql: getTableDeletionQuery(tableModel)
      })
    })

    it('Throw error for wrong sql query via run-in-trans-action', async () => {
      try {
        await fac.asyncQuery({
          action: DB_WORKER_ACTIONS.RUN_IN_TRANS,
          sql: 'wrong'
        })
      } catch (err) {
        assert.throws(
          () => { throw err },
          'near "wrong": syntax error'
        )
      }
    })

    describe('Table query', () => {
      beforeEach(async () => {
        await fac.asyncQuery({
          action: DB_WORKER_ACTIONS.RUN_IN_TRANS,
          sql: getTableCreationQuery(tableModel)
        })
      })

      afterEach(async () => {
        await fac.asyncQuery({
          action: DB_WORKER_ACTIONS.RUN_IN_TRANS,
          sql: getTableDeletionQuery(tableModel)
        })
      })

      it('Fetch all data via all-action', async () => {
        const transInsertRes = await fac.asyncQuery({
          action: DB_WORKER_ACTIONS.RUN_IN_TRANS,
          sql: `INSERT INTO
            ${tableModel[0]}(number, text)
            VALUES($number, $text)`,
          params: tableData
        })

        assert.strictEqual(transInsertRes.changes, tableData.length)

        const rows = await fac.asyncQuery({
          action: BASE_DB_WORKER_ACTIONS.ALL,
          sql: `SELECT * FROM ${tableModel[0]}`
        })

        assert.isArray(rows)
        assert.lengthOf(rows, tableData.length)

        for (const [i, row] of rows.entries()) {
          assert.isFinite(row.id)
          assert.ownInclude(row, tableData[i])
        }
      })

      it('Fetch one row via get-action', async () => {
        await fac.asyncQuery({
          action: DB_WORKER_ACTIONS.RUN_IN_TRANS,
          sql: `INSERT INTO
            ${tableModel[0]}(number, text)
            VALUES($number, $text)`,
          params: tableData[0]
        })

        const row = await fac.asyncQuery({
          action: BASE_DB_WORKER_ACTIONS.GET,
          sql: `SELECT * FROM ${tableModel[0]}`
        })

        assert.isObject(row)
        assert.isFinite(row.id)
        assert.ownInclude(row, tableData[0])
      })
    })
  })
})
