'use strict'

module.exports = (db, sql, params) => {
  return db.prepare(sql).all(...params)
}
