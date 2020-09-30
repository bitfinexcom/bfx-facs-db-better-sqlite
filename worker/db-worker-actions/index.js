'use strict'

const DB_WORKER_ACTIONS = require('./db-worker-actions.const')

const actionAll = require('./action-all')

module.exports = (db, args) => {
  const { action, sql, params } = args

  if (action === DB_WORKER_ACTIONS.ALL) {
    return actionAll(db, sql, params)
  }

  throw new Error('ERR_ACTION_HAS_NOT_FOUND')
}
