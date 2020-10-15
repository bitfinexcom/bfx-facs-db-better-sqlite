'use strict'

module.exports = (db, sql, params) => {
  const isSqlArray = Array.isArray(sql)
  const sqlArr = isSqlArray ? sql : [sql]
  const { simple = true } = { ...params }

  const res = []

  for (const query of sqlArr) {
    res.push(db.pragma(query, { simple }))
  }

  return isSqlArray ? res : res[0]
}
