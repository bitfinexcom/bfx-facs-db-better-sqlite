'use strict'

module.exports = (model) => {
  const isOneModel = (
    Array.isArray(model) &&
    typeof model[0] === 'string'
  )
  const _modelsArr = isOneModel
    ? [model]
    : model

  const res = _modelsArr.map(([name, model]) => {
    const keys = Object.keys(model)
    const columnDefs = keys.reduce((accum, field, i, arr) => {
      const ending = arr.length === (i + 1) ? '' : ', \n  '
      const type = model[field]

      return `${accum}${field} ${type}${ending}`
    }, '')
    const starting = 'CREATE TABLE IF NOT EXISTS'

    return `${starting} ${name}\n(\n  ${columnDefs}\n)`
  })

  return isOneModel ? res[0] : res
}
