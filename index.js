'use strict'

const path = require('path')
const fs = require('fs')
const async = require('async')
const { Worker } = require('worker_threads')
const os = require('os')

const Database = require('better-sqlite3')
const Base = require('bfx-facs-base')

const DB_WORKER_ACTIONS = require(
  './worker/db-worker-actions/db-worker-actions.const'
)

class Sqlite extends Base {
  constructor (caller, opts, ctx) {
    super(caller, opts, ctx)

    this._hasConf = false
    this._workers = new Set()
    this._queue = []

    this.name = 'db-sqlite'
    this.opts = this._getOpts()

    this.init()
  }

  _getOpts () {
    const {
      minWorkersCount = 4,
      maxWorkersCount = 16,
      workerPathAbsolute,
      dbPathAbsolute,
      label
    } = this.opts

    const baseName = `${this.name}_${this.opts.name}_${label}.db`

    const dbPath = (
      typeof dbPathAbsolute === 'string' &&
      path.isAbsolute(dbPathAbsolute)
    )
      ? path.join(dbPathAbsolute, baseName)
      : path.join(this.caller.ctx.root, 'db', baseName)
    const workerPath = (
      typeof workerPathAbsolute === 'string' &&
      path.isAbsolute(workerPathAbsolute)
    )
      ? workerPathAbsolute
      : path.join(__dirname, 'worker', 'index.js')

    return {
      ...this.opts,
      dbPath,
      workerPath,
      minWorkersCount,
      maxWorkersCount
    }
  }

  _start (cb) {
    async.series([
      (next) => { super._start(next) },
      (next) => {
        const {
          isNotWorkerSpawned,
          workerPath,
          dbPath,
          readonly = false,
          fileMustExist = false,
          timeout = 5000,
          verbose = false
        } = this.opts
        const dbDir = path.dirname(dbPath)
        const params = {
          readonly,
          fileMustExist,
          timeout,
          ...(verbose ? { verbose: console.log } : {})
        }

        fs.access(dbDir, fs.constants.W_OK, (err) => {
          if (err && err.code === 'ENOENT') {
            const msg = `the directory ${dbDir} does not exist, please create`

            return next(new Error(msg))
          }
          if (err) {
            return cb(err)
          }

          try {
            this.db = new Database(dbPath, params)

            if (isNotWorkerSpawned) {
              next()

              return
            }

            this._spawnWorkers(
              workerPath,
              {
                ...params,
                dbPath,
                verbose
              }
            )
          } catch (err) {
            next(err)
          }

          next()
        })
      }
    ], cb)
  }

  asyncQuery (args) {
    if (
      this.opts.isNotWorkerSpawned ||
      this._workers.size === 0
    ) {
      throw new Error('ERR_WORKER_HAS_NOT_BEEN_SPAWNED')
    }

    const { action, sql, params } = { ...args }

    return new Promise((resolve, reject) => {
      this._queue.push({
        resolve,
        reject,
        message: { action, sql, params }
      })
    })
  }

  _getRequiredWorkersCount () {
    const cpusCount = os.cpus().length
    const minRequiredWorkersCount = Math.max(
      cpusCount,
      this.opts.minWorkersCount
    )
    const maxRequiredWorkersCount = Math.min(
      minRequiredWorkersCount,
      this.opts.minWorkersCount
    )

    return maxRequiredWorkersCount
  }

  _spawnWorkers (workerPath, workerData) {
    const spawn = () => {
      const worker = new Worker(
        workerPath,
        { workerData }
      )
      this._workers.add(worker)

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
        .on('online', poll)
        .on('message', (err, result) => {
          if (err) {
            job.reject(err)
            job = null

            poll()

            return
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
          this._workers.delete(worker)

          if (job) {
            job.reject(error || new Error('worker died'))
          }
          if (code !== 0) {
            console.error(`worker exited with code ${code}`)

            spawn()
          }
        })
    }

    new Array(this._getRequiredWorkersCount())
      .fill().forEach(spawn)
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
      },
      (next) => {
        const promises = [...this._workers].map((worker) => {
          return new Promise((resolve, reject) => {
            try {
              worker.on('exit', resolve)
              worker.postMessage({ action: DB_WORKER_ACTIONS.CLOSE_DB })
            } catch (err) {
              reject(err)
            }
          })
        })

        this._workers.clear()

        Promise.allSettled(promises).then(() => next())
      }
    ], cb)
  }
}

module.exports = Sqlite
