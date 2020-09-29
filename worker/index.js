'use strict'

const { parentPort } = require('worker_threads')
const Database = require('better-sqlite3')

const DB_WORKER_ACTIONS = require('./db-worker-actions.const')

let db

const _execute = (args) => {
  const { action, sql, params } = args

  if (action === DB_WORKER_ACTIONS.ALL) {
    return db.prepare(sql).all(...params)
  }
}

parentPort.on('message', (args) => {
  const { action, params } = args

  if (!action) {
    throw new Error('ERR_ACTION_HAS_NOT_FOUND')
  }
  if (action === DB_WORKER_ACTIONS.INIT) {
    db = new Database(...params)

    parentPort.postMessage({ isDbReady: true })
  }
  if (!(db instanceof Database)) {
    throw new Error('ERR_DB_HAS_NOT_INITIALIZED')
  }

  const result = _execute(args)
  parentPort.postMessage(result)
})
