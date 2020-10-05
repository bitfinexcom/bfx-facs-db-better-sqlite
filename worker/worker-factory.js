'use strict'

const DB_WORKER_ACTIONS = require(
  './db-worker-actions/db-worker-actions.const'
)

module.exports = (executeAction) => {
  const { workerData, parentPort } = require('worker_threads')
  const Database = require('better-sqlite3')

  const _connect = (args) => {
    const {
      dbPath = './sqlite-db.db',
      readonly = false,
      fileMustExist = false,
      timeout = 5000,
      verbose = false
    } = args

    return new Database(
      dbPath,
      {
        readonly,
        fileMustExist,
        timeout,
        ...(verbose ? { verbose: console.log } : {})
      }
    )
  }

  const _serializeError = (err) => {
    if (!(err instanceof Error)) {
      return err
    }

    return Object.keys(err).reduce((obj, key) => {
      obj[key] = err[key]

      return obj
    }, {
      name: err.name,
      message: err.message,
      stack: err.stack,
      isError: true
    })
  }

  const db = _connect(workerData)

  parentPort.on('message', (args) => {
    try {
      const { action } = args

      if (!(db instanceof Database)) {
        throw new Error('ERR_DB_HAS_NOT_INITIALIZED')
      }
      if (!action) {
        throw new Error('ERR_ACTION_HAS_NOT_PASSED')
      }
      if (action === DB_WORKER_ACTIONS.CLOSE_DB) {
        db.close()
        process.exit(0)
      }

      const result = executeAction(db, args)
      parentPort.postMessage(null, result)
    } catch (err) {
      const _err = _serializeError(err)
      parentPort.postMessage(_err)
    }
  })
}
