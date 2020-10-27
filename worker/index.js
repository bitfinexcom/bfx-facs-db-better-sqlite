'use strict'

const executeAction = require('./db-worker-actions')
const workerFactory = require('./worker-factory')

workerFactory(executeAction)
