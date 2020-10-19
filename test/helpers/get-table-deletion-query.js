'use strict'

module.exports = (model) => {
  const isOneModel = (
    Array.isArray(model) &&
    typeof model[0] === 'string'
  )
  const _modelsArr = isOneModel
    ? [model]
    : model

  const res = _modelsArr.map(([name]) => {
    return `DROP TABLE IF EXISTS ${name}`
  })

  return isOneModel ? res[0] : res
}
