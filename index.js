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
    this._workers = new Map()
    this._queue = []

    this.name = 'db-sqlite'
    this.opts = this._getOpts()

    this.init()
  }

  _getOpts () {
    const {
      unacceptableWalFileSize = 100000000,
      minWorkersCount = 4,
      maxWorkersCount = 16,
      workerPathAbsolute,
      dbPathAbsolute,
      name,
      label
    } = this.opts

    const _name = name ? `_${name}` : ''
    const _label = label ? `_${label}` : ''
    const baseName = `${this.name}${_name}${_label}.db`

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
      maxWorkersCount,
      unacceptableWalFileSize
    }
  }

  _initDb (cb) {
    const {
      isSqliteStoredInMemory,
      isNotWorkerSpawned,
      workerPath,
      dbPath: _dbPath,
      readonly = false,
      fileMustExist = false,
      timeout = 5000,
      verbose = false
    } = this.opts
    const params = {
      readonly,
      fileMustExist,
      timeout,
      ...(verbose ? { verbose: console.log } : {})
    }
    const dbPath = isSqliteStoredInMemory
      ? ':memory:'
      : _dbPath

    try {
      this.db = new Database(dbPath, params)

      if (isNotWorkerSpawned) {
        cb()

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
      cb(err)
    }

    cb()
  }

  _start (cb) {
    async.series([
      (next) => { super._start(next) },
      (next) => {
        const {
          isSqliteStoredInMemory,
          dbPath
        } = this.opts

        if (isSqliteStoredInMemory) {
          this._initDb(next)

          return
        }

        const dbDir = path.dirname(dbPath)

        fs.access(dbDir, fs.constants.W_OK, (err) => {
          if (err && err.code === 'ENOENT') {
            const msg = `the directory ${dbDir} does not exist, please create`

            return next(new Error(msg))
          }
          if (err) {
            return cb(err)
          }

          this._initDb(next)
        })
      }
    ], cb)
  }

  asyncQuery (args) {
    if (this.opts.isNotWorkerSpawned) {
      throw new Error('ERR_WORKER_HAS_NOT_BEEN_SPAWNED')
    }

    const { action, sql, params } = { ...args }

    return new Promise((resolve, reject) => {
      const workerArr = [...this._workers]
        .reverse()
        .find(([, jobData]) => {
          return !jobData.job && jobData.isOnline
        })
      const job = {
        resolve,
        reject,
        message: { action, sql, params }
      }

      if (!Array.isArray(workerArr)) {
        this._queue.push(job)

        return
      }

      const [worker, jobData] = workerArr

      jobData.job = job
      worker.postMessage(job.message)
    })
  }

  initializeWalCheckpointRestart (ms = 10000) {
    const {
      dbPath,
      unacceptableWalFileSize,
      isNotWorkerSpawned
    } = this.opts
    const walFile = `${dbPath}-wal`

    clearInterval(this._checkpointRestartInterval)

    this._checkpointRestartInterval = setInterval(() => {
      fs.stat(walFile, (err, stat) => {
        if (err) {
          if (err.code === 'ENOENT') return

          throw err
        }
        if (stat.size < unacceptableWalFileSize) {
          return
        }
        if (isNotWorkerSpawned) {
          this.db.pragma('wal_checkpoint(RESTART)')

          return
        }

        this.asyncQuery({
          action: DB_WORKER_ACTIONS.EXEC_PRAGMA,
          sql: 'wal_checkpoint(RESTART)'
        }).catch((err) => console.error(err))
      })
    }, ms).unref()
  }

  _getRequiredWorkersCount () {
    const cpusCount = os.cpus().length
    const minRequiredWorkersCount = Math.max(
      cpusCount,
      this.opts.minWorkersCount
    )
    const maxRequiredWorkersCount = Math.min(
      minRequiredWorkersCount,
      this.opts.maxWorkersCount
    )

    return Math.max(maxRequiredWorkersCount, 1)
  }

  _spawnWorkers (workerPath, workerData) {
    const spawn = () => {
      const worker = new Worker(
        workerPath,
        { workerData }
      )
      const jobData = {
        job: null,
        error: null,
        timer: null,
        isOnline: false
      }
      this._workers.set(worker, jobData)

      const poll = () => {
        jobData.isOnline = true

        if (
          this._queue.length !== 0 &&
          !jobData.job
        ) {
          jobData.job = this._queue.shift()
          worker.postMessage(jobData.job.message)

          return
        }

        jobData.timer = setTimeout(poll, 3000)
      }
      const process = ({ err, result }) => {
        if (err) {
          const _err = this._deserializeError(err)

          jobData.job.reject(_err)
          jobData.job = null

          poll()

          return
        }

        jobData.job.resolve(result)
        jobData.job = null

        poll()
      }

      worker
        .on('online', poll)
        .on('message', process)
        .on('error', (err) => {
          const _err = this._deserializeError(err)
          console.error(_err)

          jobData.error = _err
        })
        .on('exit', (code) => {
          clearTimeout(jobData.timer)
          this._workers.delete(worker)

          if (jobData.job) {
            jobData.job.reject(jobData.error || new Error('worker died'))
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

  _deserializeError (err) {
    if (err instanceof Error) {
      return err
    }

    return Object.keys(err).reduce((obj, key) => {
      obj[key] = err[key]

      return obj
    }, new Error())
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
        const promises = [...this._workers].map(([worker]) => {
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
