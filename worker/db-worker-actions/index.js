'use strict'

const DB_WORKER_ACTIONS = require('./db-worker-actions.const')
const ACTIONS_MAP = {
  [DB_WORKER_ACTIONS.CLOSE_DB]: require('./action-close-db'),
  [DB_WORKER_ACTIONS.GET]: require('./action-get'),
  [DB_WORKER_ACTIONS.ALL]: require('./action-all'),
  [DB_WORKER_ACTIONS.RUN]: require('./action-run'),
  [DB_WORKER_ACTIONS.EXEC_PRAGMA]: require('./action-exec-pragma')
}

module.exports = (db, args) => {
  const { action, sql, params } = args

  if (ACTIONS_MAP[action]) {
    return ACTIONS_MAP[action](db, sql, params)
  }

  throw new Error('ERR_ACTION_HAS_NOT_BEEN_FOUND')
}
