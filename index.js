'use strict'

const path = require('path')
const fs = require('fs')
const async = require('async')
const { Worker } = require('worker_threads')
const os = require('os')

const Database = require('better-sqlite3')
const Base = require('bfx-facs-base')

const DB_WORKER_ACTIONS = require(
  './worker/db-worker-actions.const'
)

class Sqlite extends Base {
  constructor (caller, opts, ctx) {
    super(caller, opts, ctx)

    this.name = 'db-sqlite'
    this._hasConf = false
    this._queue = []

    const cal = this.caller

    const {
      dbPathAbsolute,
      label
    } = this.opts
    const baseName = `${this.name}_${this.opts.name}_${label}.db`
    const db = (
      typeof dbPathAbsolute === 'string' &&
      path.isAbsolute(dbPathAbsolute)
    )
      ? path.join(dbPathAbsolute, baseName)
      : path.join(cal.ctx.root, 'db', baseName)
    this.opts = {
      ...opts,
      ...this.opts,
      db
    }

    this.init()
  }

  _start (cb) {
    async.series([
      (next) => { super._start(next) },
      (next) => {
        const {
          db,
          readonly,
          fileMustExist,
          busyTimeout: timeout = 5000,
          verbose
        } = this.opts
        const dbDir = path.dirname(db)
        const dbParams = [
          db,
          {
            readonly,
            fileMustExist,
            timeout,
            verbose
          }
        ]

        fs.access(dbDir, fs.constants.W_OK, (err) => {
          if (err && err.code === 'ENOENT') {
            const msg = `the directory ${dbDir} does not exist, please create`

            return next(new Error(msg))
          }
          if (err) {
            return cb(err)
          }

          try {
            this.db = new Database(...dbParams)
            this._spawnWorkers(dbParams)
          } catch (err) {
            next(err)
          }

          next()
        })
      }
    ], cb)
  }

  asyncQuery (args) {
    const { action, sql, params } = { ...args }

    return new Promise((resolve, reject) => {
      this._queue.push({
        resolve,
        reject,
        message: { action, sql, params }
      })
    })
  }

  _spawnWorkers (params) {
    const spawn = () => {
      // TODO: also need to provide absolute pass from conf
      const worker = new Worker('./worker.js')

      let isDbReady = false
      let job = null
      let error = null
      let timer = null

      const poll = () => {
        if (this._queue.length) {
          job = this._queue.shift()
          worker.postMessage(job.message)

          return
        }

        timer = setImmediate(poll)
      }

      worker
        .on('online', () => {
          if (!isDbReady) {
            worker.postMessage({
              action: DB_WORKER_ACTIONS.INIT,
              params
            })
          }

          poll()
        })
        .on('message', (result) => {
          if (
            !isDbReady &&
            result &&
            typeof result === 'object' &&
            result.isDbReady
          ) {
            isDbReady = true
          }

          job.resolve(result)
          job = null
          poll()
        })
        .on('error', (err) => {
          console.error(err)
          error = err
        })
        .on('exit', (code) => {
          clearImmediate(timer)

          if (job) {
            job.reject(error || new Error('worker died'))
          }
          if (code !== 0) {
            console.error(`worker exited with code ${code}`)
            spawn()
          }
        })
    }

    os.cpus().forEach(spawn)
  }

  _stop (cb) {
    async.series([
      (next) => { super._stop(next) },
      (next) => {
        try {
          this.db.close()
        } catch (e) {
          console.error(e)
        }

        delete this.db
        next()
      }
    ], cb)
  }
}

module.exports = Sqlite
