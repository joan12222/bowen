// Singleton, persistent RPC client for lib/sqlite/worker.ts.
//
// Deliberately NOT the PoC's create-worker-per-call pattern: AccessHandlePoolVFS
// initialization is expensive, and repeatedly spinning workers up/down risks
// re-triggering the "pool exhausted / unable to open database file" issue the
// PoC had to self-heal from. One worker, opened lazily on first use, lives for
// the page's lifetime.
//
// Concurrency: every request carries a numeric id; a Map<id, {resolve, reject}>
// correlates worker responses back to the right caller, so multiple in-flight
// queries from different components resolve independently and in any order.

import type { Row, SQLiteValue, StatementSpec } from './worker'

type PendingEntry = { resolve: (value: any) => void; reject: (reason: unknown) => void }

type WorkerResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: string }

let worker: Worker | null = null
let nextRequestId = 1
const pending = new Map<number, PendingEntry>()
let initPromise: Promise<void> | null = null

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const { id } = event.data
      const entry = pending.get(id)
      if (!entry) return
      pending.delete(id)
      if (event.data.ok) entry.resolve(event.data.result)
      else entry.reject(new Error(event.data.error))
    }
    worker.onerror = (event) => {
      const error = new Error(event.message || 'SQLite worker error')
      for (const [id, entry] of pending) {
        entry.reject(error)
        pending.delete(id)
      }
    }
  }
  return worker
}

function send<T>(message: { type: string } & Record<string, unknown>): Promise<T> {
  const id = nextRequestId++
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    getWorker().postMessage({ id, ...message })
  })
}

// Must be awaited before any exec/query/transaction call from a fresh page
// load — lazily memoized so callers can invoke it defensively without
// triggering duplicate worker initialization.
export function ensureDatabaseReady(): Promise<void> {
  if (!initPromise) initPromise = send<null>({ type: 'init' }).then(() => undefined)
  return initPromise
}

export async function exec(sql: string, params?: SQLiteValue[]): Promise<{ changes: number }> {
  await ensureDatabaseReady()
  return send({ type: 'exec', sql, params })
}

export async function query(sql: string, params?: SQLiteValue[]): Promise<Row[]> {
  await ensureDatabaseReady()
  return send({ type: 'query', sql, params })
}

export async function transaction(statements: StatementSpec[]): Promise<Array<{ changes: number }>> {
  await ensureDatabaseReady()
  return send({ type: 'transaction', statements })
}

// Triggers the lazy shici-300 seed (only fetches/inserts the ~1.2MB dataset
// the first time /shici is visited; a no-op on subsequent calls once seeded).
export async function seedShici(): Promise<void> {
  await ensureDatabaseReady()
  await send({ type: 'seedShici' })
}
