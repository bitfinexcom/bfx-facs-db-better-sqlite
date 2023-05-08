'use strict'

const fs = require('fs')

const rmRfSync = (path) => fs.rmSync(path, {
  recursive: true,
  force: true
})

module.exports = {
  rmRfSync
}
