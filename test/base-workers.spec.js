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
const tableData = [
  { number: 11, text: 'test-11' },
  { number: 12, text: 'test-12' },
  { number: 13, text: 'test-13' },
  { number: 14, text: 'test-14' },
  { number: 15, text: 'test-15' }
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

    it('Throw error for wrong sql query via run-action', async () => {
      try {
        await fac.asyncQuery({
          action: DB_WORKER_ACTIONS.RUN,
          sql: 'wrong'
        })
      } catch (err) {
        assert.throws(
          () => { throw err },
          'near "wrong": syntax error'
        )
      }
    })

    it('Fetch all data via all-action', async () => {
      await fac.asyncQuery({
        action: DB_WORKER_ACTIONS.RUN,
        sql: getTableCreationQuery(tableModel)
      })

      for (const params of tableData) {
        await fac.asyncQuery({
          action: DB_WORKER_ACTIONS.RUN,
          sql: `INSERT INTO
            ${tableModel[0]}(number, text)
            VALUES($number, $text)`,
          params
        })
      }

      const rows = await fac.asyncQuery({
        action: DB_WORKER_ACTIONS.ALL,
        sql: `SELECT * FROM ${tableModel[0]}`
      })

      assert.lengthOf(rows, tableData.length)

      for (const [i, row] of rows.entries()) {
        assert.isFinite(row.id)
        assert.ownInclude(row, tableData[i])
      }

      await fac.asyncQuery({
        action: DB_WORKER_ACTIONS.RUN,
        sql: getTableDeletionQuery(tableModel)
      })
    })
  })
})
