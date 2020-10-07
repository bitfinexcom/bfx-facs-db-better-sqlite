'use strict'

module.exports = (db, sql, params) => {
  const stm = db.prepare(sql)

  return typeof params === 'undefined'
    ? stm.all()
    : stm.all(params)
}
