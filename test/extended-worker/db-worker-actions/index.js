'use strict'

const dbWorkerActions = require(
  '../../../worker/db-worker-actions'
)

const DB_WORKER_ACTIONS = require('./db-worker-actions.const')

const actionRunInTrans = require('./action-run-in-trans')

module.exports = (db, args) => {
  const { action, sql, params } = args

  if (action === DB_WORKER_ACTIONS.RUN_IN_TRANS) {
    return actionRunInTrans(db, sql, params)
  }

  return dbWorkerActions(db, args)
}
