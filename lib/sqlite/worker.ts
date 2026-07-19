// Worker-owned SQLite connection (wa-sqlite + OPFS via AccessHandlePoolVFS).
// Generalizes the PoC in lib/sqlite-poc.worker.ts into a persistent singleton
// that the main thread drives over request-ID-keyed RPC (see ./client.ts).
// AccessHandlePoolVFS requires FileSystemFileHandle.createSyncAccessHandle,
// which browsers restrict to Worker contexts — hence the DB must live here.
//
// Message protocol (every message/response carries the same `id` for
// correlation; see ./client.ts for the matching Promise-based wrapper):
//   -> { id, type: 'init' }                                          => null
//   -> { id, type: 'exec', sql, params? }                            => { changes }
//   -> { id, type: 'query', sql, params? }                           => Row[]
//   -> { id, type: 'transaction', statements: [{ sql, params? }] }   => { changes }[]
//   -> { id, type: 'seedShici' }                                     => null
//   <- { id, ok: true, result } | { id, ok: false, error }

import { SQLITE_SCHEMA } from '../sqlite-schema'
import {
  BUILTIN_CONTENT_SEED_VERSION,
  SHICI_SEED_VERSION,
  seedBuiltinContentIfNeeded,
  seedShiciIfNeeded,
} from './seed'

const POOL_DIR = 'bowen'
const DB_FILENAME = 'bowen.sqlite'
const SQLITE_ROW = 100

export type SQLiteValue = number | string | Uint8Array | bigint | null
export type Row = Record<string, SQLiteValue>
export type StatementSpec = { sql: string; params?: SQLiteValue[] }

// `Factory(module)` returns wa-sqlite's dynamically-shaped low-level API —
// typing it precisely would mean importing wa-sqlite's internal types just
// for this file; `any` mirrors how the PoC already treats it.
let sqlite3: any = null
let db = 0
let vfs: any = null
let readyPromise: Promise<void> | null = null

// AccessHandlePoolVFS keeps a fixed-size pool of OPFS files persistently
// associated with SQLite file paths. A worker killed mid-transaction (e.g. a
// dev-mode Fast Refresh reload) can leave orphaned associations behind,
// eventually exhausting the pool — SQLite then fails with "unable to open
// database file". Recover by wiping the pool directory and rebuilding it.
// (Proven in lib/sqlite-poc.worker.ts.)
async function wipePoolDirectory() {
  const root = await navigator.storage.getDirectory()
  await root.removeEntry(POOL_DIR, { recursive: true }).catch(() => {})
}

async function openDatabase(wipeFirst: boolean) {
  if (wipeFirst) await wipePoolDirectory()

  const { AccessHandlePoolVFS } = await import('wa-sqlite/src/examples/AccessHandlePoolVFS.js')
  vfs = new AccessHandlePoolVFS(`/${POOL_DIR}`)
  await vfs.isReady
  sqlite3.vfs_register(vfs, true)
  db = await sqlite3.open_v2(DB_FILENAME)
}

// Compiles + steps a single parameterized statement, collecting result rows
// as plain objects keyed by column name — this is the shape lib/db.local.ts's
// rowTo* converters expect (mirrors the row objects Postgres/PostgREST returned).
// Uses sqlite3.statements()/bind_collection()/step()/row(), NOT string
// interpolation — user-generated content (custom texts, translations, etc.)
// must never be spliced directly into SQL.
async function run(sql: string, params?: SQLiteValue[]): Promise<Row[]> {
  const rows: Row[] = []
  for await (const stmt of sqlite3.statements(db, sql)) {
    if (params && params.length) sqlite3.bind_collection(stmt, params)
    const columns: string[] = sqlite3.column_names(stmt)
    while ((await sqlite3.step(stmt)) === SQLITE_ROW) {
      const values = sqlite3.row(stmt)
      const row: Row = {}
      columns.forEach((name, i) => { row[name] = values[i] })
      rows.push(row)
    }
  }
  return rows
}

async function execStatement(sql: string, params?: SQLiteValue[]): Promise<{ changes: number }> {
  await run(sql, params)
  return { changes: sqlite3.changes(db) }
}

async function runTransaction(statements: StatementSpec[]): Promise<Array<{ changes: number }>> {
  await sqlite3.exec(db, 'BEGIN')
  try {
    const results: Array<{ changes: number }> = []
    for (const { sql, params } of statements) {
      results.push(await execStatement(sql, params))
    }
    await sqlite3.exec(db, 'COMMIT')
    return results
  } catch (e) {
    await sqlite3.exec(db, 'ROLLBACK').catch(() => {})
    throw e
  }
}

async function getMetaVersion(key: string): Promise<number> {
  const rows = await run('SELECT value FROM meta WHERE key = ?', [key])
  if (!rows.length) return 0
  return Number(rows[0].value) || 0
}

async function setMetaVersion(key: string, version: number) {
  await execStatement(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, String(version)]
  )
}

async function seedShiciIfStale() {
  const current = await getMetaVersion('shici_seed_version')
  if (current >= SHICI_SEED_VERSION) return
  await seedShiciIfNeeded({ transaction: runTransaction }, current)
  await setMetaVersion('shici_seed_version', SHICI_SEED_VERSION)
}

async function init() {
  // Request persistent storage FIRST — the strongest (if imperfect) defence
  // against iOS/mobile browsers silently evicting OPFS data under storage
  // pressure. Must run on every launch, not only on first install: the OS can
  // revoke persistence, and re-requesting costs nothing if already granted.
  if (navigator.storage?.persist) {
    await navigator.storage.persist().catch(() => false)
  }

  const SQLiteESMFactory = (await import('wa-sqlite/dist/wa-sqlite.mjs')).default
  const { Factory } = await import('wa-sqlite')

  // The worker's own URL is often a blob: URL (bundler-wrapped), so a
  // path-only string can't be resolved by fetch — build an absolute URL
  // against the page's origin instead (same trick as the PoC).
  const wasmUrl = new URL('/wa-sqlite.wasm', self.location.origin).href
  const module = await SQLiteESMFactory({ locateFile: () => wasmUrl })
  sqlite3 = Factory(module)

  try {
    await openDatabase(false)
  } catch (e) {
    if (!String(e).includes('unable to open database file')) throw e
    await openDatabase(true)
  }

  await run('DROP TABLE IF EXISTS poem_cards').catch(() => {})
  await run('DROP TABLE IF EXISTS shici_cards').catch(() => {})
  await sqlite3.exec(db, SQLITE_SCHEMA)

  const contentVersion = await getMetaVersion('seed_version')
  if (contentVersion < BUILTIN_CONTENT_SEED_VERSION) {
    await seedBuiltinContentIfNeeded({ transaction: runTransaction }, contentVersion)
    await setMetaVersion('seed_version', BUILTIN_CONTENT_SEED_VERSION)
  }
}

function ensureReady(): Promise<void> {
  if (!readyPromise) readyPromise = init()
  return readyPromise
}

type Message =
  | { id: number; type: 'init' }
  | { id: number; type: 'exec'; sql: string; params?: SQLiteValue[] }
  | { id: number; type: 'query'; sql: string; params?: SQLiteValue[] }
  | { id: number; type: 'transaction'; statements: StatementSpec[] }
  | { id: number; type: 'seedShici' }

self.onmessage = async (event: MessageEvent<Message>) => {
  const msg = event.data
  try {
    await ensureReady()

    let result: unknown = null
    switch (msg.type) {
      case 'init':
        break
      case 'exec':
        result = await execStatement(msg.sql, msg.params)
        break
      case 'query':
        result = await run(msg.sql, msg.params)
        break
      case 'transaction':
        result = await runTransaction(msg.statements)
        break
      case 'seedShici':
        await seedShiciIfStale()
        break
    }
    self.postMessage({ id: msg.id, ok: true, result })
  } catch (e) {
    self.postMessage({ id: msg.id, ok: false, error: String(e instanceof Error ? e.stack || e.message : e) })
  }
}
