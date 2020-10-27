'use strict'

const dbWorkerActions = require(
  '../../../worker/db-worker-actions'
)

const DB_WORKER_ACTIONS = require('./db-worker-actions.const')
const ACTIONS_MAP = {
  [DB_WORKER_ACTIONS.RUN_IN_TRANS]: require('./action-run-in-trans')
}

module.exports = (db, args) => {
  const { action, sql, params } = args

  if (ACTIONS_MAP[action]) {
    return ACTIONS_MAP[action](db, sql, params)
  }

  return dbWorkerActions(db, args)
}
