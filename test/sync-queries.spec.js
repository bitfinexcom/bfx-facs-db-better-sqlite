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

const DB_WORKER_ACTIONS = require(
  '../worker/db-worker-actions/db-worker-actions.const'
)
const Fac = require('..')
const caller = { ctx: { root: __dirname } }
const dbPathAbsolute = path.join(__dirname, 'db')

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

describe('Sync queries', () => {
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
      { dbPathAbsolute, isNotWorkerSpawned: true }
    )

    fac.start((err) => {
      assert.ifError(err)
      assert.isOk(fac._workers.size === 0)

      fac.stop((err) => {
        assert.ifError(err)
        assert.isOk(fac._workers.size === 0)

        done()
      })
    })
  })

  it('Throw error if worker is not spawned', async () => {
    const fac = await new Promise((resolve, reject) => {
      const fac = new Fac(
        caller,
        { dbPathAbsolute, isNotWorkerSpawned: true }
      )

      fac.start((err) => {
        if (err) reject(err)

        assert.isOk(fac._workers.size === 0)

        fac.stop((err) => {
          if (err) reject(err)

          assert.isOk(fac._workers.size === 0)

          resolve(fac)
        })
      })
    })

    try {
      await fac.asyncQuery({
        action: DB_WORKER_ACTIONS.RUN,
        sql: getTableCreationQuery(tableModel)
      })
    } catch (err) {
      assert.throws(
        () => { throw err },
        'ERR_WORKER_HAS_NOT_BEEN_SPAWNED'
      )
    }
  })

  describe('Query', () => {
    let fac

    before((done) => {
      fac = new Fac(
        caller,
        { dbPathAbsolute, isNotWorkerSpawned: true }
      )
      fac.start(done)
    })

    after((done) => {
      fac.stop(done)
    })

    it('Enable WAL journal mode in PRAGMA', (done) => {
      const res = fac.db.pragma(
        'journal_mode = WAL',
        { simple: true }
      )

      assert.strictEqual(res, 'wal')

      fac.initializeWalCheckpointRestart(1000)
      setTimeout(done, 1000)
    })

    it('Create table', () => {
      fac.db.prepare(getTableCreationQuery(tableModel)).run()
      fac.db.prepare(getTableDeletionQuery(tableModel)).run()
    })

    it('Throw error for wrong sql query', () => {
      try {
        fac.db.prepare('wrong').run()
      } catch (err) {
        assert.throws(
          () => { throw err },
          'near "wrong": syntax error'
        )
      }
    })

    describe('Table query', () => {
      beforeEach(() => {
        fac.db.prepare(getTableCreationQuery(tableModel)).run()
      })

      afterEach(() => {
        fac.db.prepare(getTableDeletionQuery(tableModel)).run()
      })

      it('Fetch all data', () => {
        for (const params of tableData) {
          fac.db
            .prepare(`INSERT INTO
              ${tableModel[0]}(number, text)
              VALUES($number, $text)`)
            .run(params)
        }

        const rows = fac.db
          .prepare(`SELECT * FROM ${tableModel[0]}`)
          .all()

        assert.isArray(rows)
        assert.lengthOf(rows, tableData.length)

        for (const [i, row] of rows.entries()) {
          assert.isFinite(row.id)
          assert.ownInclude(row, tableData[i])
        }
      })

      it('Fetch one row', () => {
        fac.db
          .prepare(`INSERT INTO
            ${tableModel[0]}(number, text)
            VALUES($number, $text)`)
          .run(tableData[0])

        const row = fac.db
          .prepare(`SELECT * FROM ${tableModel[0]}`)
          .get()

        assert.isObject(row)
        assert.isFinite(row.id)
        assert.ownInclude(row, tableData[0])
      })
    })
  })
})
