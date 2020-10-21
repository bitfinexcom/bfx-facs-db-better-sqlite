'use strict'

const { assert } = require('chai')
const path = require('path')
const {
  rmdirSync,
  mkdirSync
} = require('fs')
const { promisify } = require('util')

const {
  getTableCreationQuery,
  getTableDeletionQuery
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

describe('Load extended worker', () => {
  let fac

  before(async () => {
    rmdirSync(dbPathAbsolute, { recursive: true })
    mkdirSync(dbPathAbsolute, { recursive: true })

    fac = new Fac(
      caller,
      { dbPathAbsolute, workerPathAbsolute, timeout: 20000 }
    )

    await promisify(fac.start.bind(fac))()
    await fac.asyncQuery({
      action: BASE_DB_WORKER_ACTIONS.EXEC_PRAGMA,
      sql: 'journal_mode = WAL'
    })
  })

  after((done) => {
    fac.stop(() => {
      rmdirSync(dbPathAbsolute, { recursive: true })
      done()
    })
  })

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

  it('Insert/select rows per 10 parallel operations by 500000 items via run-in-trans-action', async function () {
    this.timeout(120000)

    const parallelOperationCount = 10
    const rowsLength = 500000

    const runner = async (length) => {
      const transInsertRes = await fac.asyncQuery({
        action: DB_WORKER_ACTIONS.RUN_IN_TRANS,
        sql: `INSERT INTO
          ${tableModel[0]}(number, text)
          VALUES($number, $text)`,
        params: new Array(length)
          .fill({ number: length, text: `test-${length}` })
      })

      assert.strictEqual(transInsertRes.changes, length)

      const rows = await fac.asyncQuery({
        action: BASE_DB_WORKER_ACTIONS.ALL,
        sql: `SELECT * FROM ${tableModel[0]}`
      })

      assert.isArray(rows)
      assert.isAtLeast(rows.length, length)
    }

    const promises = new Array(parallelOperationCount)
      .fill().map(() => runner(rowsLength))
    await Promise.all(promises)
  })

  it('Insert rows per 10 parallel operations by 500000 items via run-in-trans-action', async function () {
    this.timeout(120000)

    const parallelOperationCount = 10
    const rowsLength = 500000

    const runner = async (length) => {
      const transInsertRes = await fac.asyncQuery({
        action: DB_WORKER_ACTIONS.RUN_IN_TRANS,
        sql: `INSERT INTO
          ${tableModel[0]}(number, text)
          VALUES($number, $text)`,
        params: new Array(length)
          .fill({ number: length, text: `test-${length}` })
      })

      assert.strictEqual(transInsertRes.changes, length)
    }

    const promises = new Array(parallelOperationCount)
      .fill().map(() => runner(rowsLength))
    await Promise.all(promises)

    const rows = await fac.asyncQuery({
      action: BASE_DB_WORKER_ACTIONS.ALL,
      sql: `SELECT * FROM ${tableModel[0]}`
    })

    assert.isArray(rows)
    assert.isAtLeast(rows.length, rowsLength * parallelOperationCount)
  })

  it('Select rows per 10 parallel operations by 500000 items via all-action', async function () {
    this.timeout(120000)

    const parallelOperationCount = 10
    const rowsLength = 500000

    const transInsertRes = await fac.asyncQuery({
      action: DB_WORKER_ACTIONS.RUN_IN_TRANS,
      sql: `INSERT INTO
        ${tableModel[0]}(number, text)
        VALUES($number, $text)`,
      params: new Array(rowsLength)
        .fill({ number: rowsLength, text: `test-${rowsLength}` })
    })

    assert.strictEqual(transInsertRes.changes, rowsLength)

    const runner = async (length) => {
      const rows = await fac.asyncQuery({
        action: BASE_DB_WORKER_ACTIONS.ALL,
        sql: `SELECT * FROM ${tableModel[0]}`
      })

      assert.isArray(rows)
      assert.isAtLeast(rows.length, length)
    }

    const promises = new Array(parallelOperationCount)
      .fill().map(() => runner(rowsLength))
    await Promise.all(promises)
  })

  it('Insert rows per 100000 parallel operations by 1 item via run-action', async function () {
    this.timeout(120000)

    const rowsLength = 100000

    const runner = async (params) => {
      const transInsertRes = await fac.asyncQuery({
        action: BASE_DB_WORKER_ACTIONS.RUN,
        sql: `INSERT INTO
          ${tableModel[0]}(number, text)
          VALUES($number, $text)`,
        params
      })

      assert.strictEqual(transInsertRes.changes, 1)
    }

    const promises = new Array(rowsLength)
      .fill({ number: rowsLength, text: `test-${rowsLength}` })
      .map((row) => runner(row))
    await Promise.all(promises)

    const rows = await fac.asyncQuery({
      action: BASE_DB_WORKER_ACTIONS.ALL,
      sql: `SELECT * FROM ${tableModel[0]}`
    })

    assert.isArray(rows)
    assert.isAtLeast(rows.length, rowsLength)
  })
})
