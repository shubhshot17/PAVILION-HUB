import Database from 'better-sqlite3'
import { mkdirSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from '../config.js'

const migrationsDirectory = fileURLToPath(new URL('../migrations/', import.meta.url))

export function createDatabase(databasePath = config.databasePath) {
  if (databasePath !== ':memory:') {
    mkdirSync(path.dirname(databasePath), { recursive: true })
  }

  const connection = new Database(databasePath)
  connection.pragma('foreign_keys = ON')
  connection.pragma('busy_timeout = 5000')
  if (databasePath !== ':memory:') {
    connection.pragma('journal_mode = WAL')
    connection.pragma('synchronous = NORMAL')
  }

  connection.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )
  `)

  const applied = new Set(
    connection.prepare('SELECT name FROM schema_migrations').all().map((row) => row.name),
  )
  const migrationFiles = readdirSync(migrationsDirectory)
    .filter((name) => /^\d+_.*\.sql$/.test(name))
    .sort()

  for (const name of migrationFiles) {
    if (applied.has(name)) {
      continue
    }

    const migration = readFileSync(path.join(migrationsDirectory, name), 'utf8')
    connection.transaction(() => {
      connection.exec(migration)
      connection.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(name)
    })()
  }

  return connection
}

export const database = createDatabase()
