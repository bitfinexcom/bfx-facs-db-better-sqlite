'use strict'

const getTableCreationQuery = require('./get-table-creation-query')
const getTableDeletionQuery = require('./get-table-deletion-query')
const { rmRfSync } = require('./utils')

module.exports = {
  getTableCreationQuery,
  getTableDeletionQuery,
  rmRfSync
}
