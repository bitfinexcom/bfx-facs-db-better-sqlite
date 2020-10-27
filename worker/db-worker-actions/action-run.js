'use strict'

module.exports = (db, sql, params) => {
  const stm = db.prepare(sql)

  return typeof params === 'undefined'
    ? stm.run()
    : stm.run(params)
}
