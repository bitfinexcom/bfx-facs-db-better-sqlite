'use strict'

const DB_WORKER_ACTIONS = require('./db-worker-actions.const')

const actionGet = require('./action-get')
const actionAll = require('./action-all')
const actionExecPragma = require('./action-exec-pragma')

module.exports = (db, args) => {
  const { action, sql, params } = args

  if (action === DB_WORKER_ACTIONS.GET) {
    return actionGet(db, sql, params)
  }
  if (action === DB_WORKER_ACTIONS.ALL) {
    return actionAll(db, sql, params)
  }
  if (action === DB_WORKER_ACTIONS.EXEC_PRAGMA) {
    return actionExecPragma(db, sql, params)
  }

  throw new Error('ERR_ACTION_HAS_NOT_FOUND')
}
