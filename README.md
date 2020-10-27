# bfx-facs-db-better-sqlite

## Config

Available the following config options:

```js
{
  name,
  label,
  dbPathAbsolute,
  isSqliteStoredInMemory = false,
  workerPathAbsolute,
  isNotWorkerSpawned = false,
  minWorkersCount = 4,
  maxWorkersCount = 16,
  unacceptableWalFileSize = 100000000,
  readonly = false,
  fileMustExist = false,
  timeout = 5000,
  verbose = false
}
```

- `name`: \<string\> used to construct the database name: \``db-sqlite${name}${label}.db`\`

- `label`: \<string\> used to construct the database name: \``db-sqlite${name}${label}.db`\`

- `dbPathAbsolute`: \<string\> absolute path to specify a folder for storing DB files

- `isSqliteStoredInMemory` (by default `false`): \<boolean\> store DB in memory [in-memory database](https://www.sqlite.org/inmemorydb.html), passing `":memory:"` as the first argument into the [database options](https://github.com/JoshuaWise/better-sqlite3/blob/master/docs/api.md#new-databasepath-options)

- `workerPathAbsolute`: \<string\> absolute path to specify a worker file for extending DB async query actions, see base implementation in the [./worker](worker) folder and extended implementation in the [./test/extended-worker](test/extended-worker) folder

- `isNotWorkerSpawned` (by default `false`): \<boolean\> not spawn worker threads for async queries

- `minWorkersCount` (by default `4`): \<integer\> count spawned workers are equal CPU cores count but not less than this value. If set `0` one worker will be spawned anyway

- `maxWorkersCount` (by default `16`): \<integer\> count spawned workers are equal CPU cores count but not more than this value

- `unacceptableWalFileSize` (by default `100000000`): \<integer\> unacceptable WAL file size in bytes, when the WAL file gets more than passed value `PRAGMA wal_checkpoint(RESTART)` will be executed related to [checkpoint starvation](https://github.com/JoshuaWise/better-sqlite3/blob/master/docs/performance.md#checkpoint-starvation)

- `readonly` (by default `false`): \<boolean\> open the database connection in readonly mode passing as the second argument into the [database options](https://github.com/JoshuaWise/better-sqlite3/blob/master/docs/api.md#new-databasepath-options)

- `fileMustExist` (by default `false`): \<boolean\> if the database does not exist, an Error will be thrown instead of creating a new file. This option does not affect in-memory or readonly database connections, passing as the second argument into the [database options](https://github.com/JoshuaWise/better-sqlite3/blob/master/docs/api.md#new-databasepath-options)

- `timeout` (by default `5000`): \<integer\> the number of milliseconds to wait when executing queries on a locked database, before throwing a SQLITE_BUSY error passing as the second argument into the [database options](https://github.com/JoshuaWise/better-sqlite3/blob/master/docs/api.md#new-databasepath-options)

- `verbose` (by default `false`): \<boolean\> if `true` the `console.log` will called with every SQL string executed by the database connection, passing `console.log` as the second argument into the [database options](https://github.com/JoshuaWise/better-sqlite3/blob/master/docs/api.md#new-databasepath-options)

## API

[Sqlite](index.js) class provides the following methods:

- `.asyncQuery(args)`: provides an async way to delegate a query into DB using implemented worker [actions](worker/db-worker-actions/index.js) or extended worker [actions](test/extended-worker/db-worker-actions/index.js). For that uses Node.js [worker threads](https://nodejs.org/api/worker_threads.html)

  **Parameters**:

  - `args`: \<Object\>
    - `action` (required): \<string\> action that needs to pick to process logic
    - `sql`: \<string | Array[string]\> SQL that needs to execute by the DB driver via worker
    - `params`: \<any\> parameters that pass into worker action

  **Returns**:

  - \<Promise\> contains returning action result

- `.initializeWalCheckpointRestart(ms)`: checks WAL file size in bytes which setting in `unacceptableWalFileSize` config option, by set interval, when the WAL file gets more than passed value `PRAGMA wal_checkpoint(RESTART)` will be executed related to [checkpoint starvation](https://github.com/JoshuaWise/better-sqlite3/blob/master/docs/performance.md#checkpoint-starvation)

  **Parameters**:

  - `ms` (by default 10000): \<integer\> interval in milliseconds with which the WAL file size will be checked
