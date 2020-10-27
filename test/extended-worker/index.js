'use strict'

const workerFactory = require(
  '../../worker/worker-factory'
)
const executeAction = require('./db-worker-actions')

workerFactory(executeAction)
