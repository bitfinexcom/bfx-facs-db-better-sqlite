'use strict'

const { workerData, parentPort } = require('worker_threads')
const Database = require('better-sqlite3')

const DB_WORKER_ACTIONS = require('./db-worker-actions.const')

const _connect = (args) => {
  const {
    dbPath = './sqlite-db.db',
    readonly,
    fileMustExist,
    timeout = 5000,
    verbose
  } = args

  return new Database(
    dbPath,
    {
      readonly,
      fileMustExist,
      timeout,
      verbose: verbose ? console.log : null
    }
  )
}

const _execute = (args) => {
  const { action, sql, params } = args

  if (action === DB_WORKER_ACTIONS.ALL) {
    return db.prepare(sql).all(...params)
  }
}

const db = _connect(workerData)

process.on('exit', () => db.close())
process.on('SIGHUP', () => process.exit(128 + 1))
process.on('SIGINT', () => process.exit(128 + 2))
process.on('SIGTERM', () => process.exit(128 + 15))

parentPort.on('message', (args) => {
  const { action } = args

  if (!action) {
    throw new Error('ERR_ACTION_HAS_NOT_FOUND')
  }
  if (!(db instanceof Database)) {
    throw new Error('ERR_DB_HAS_NOT_INITIALIZED')
  }

  const result = _execute(args)
  parentPort.postMessage(result)
})
