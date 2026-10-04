import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Sqlite from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { readMigrationFiles } from 'drizzle-orm/migrator'

const defaultFolder = fileURLToPath(new URL('../../drizzle/', import.meta.url))
const quote = (name) => `"${name.replaceAll('"', '""')}"`
const ignoredTables = new Set(['_prisma_migrations', '__drizzle_migrations'])

/** @typedef {{ migrationsFolder?: string }} MigrationOptions */

/** Compare SQLite structure, including composite keys, rather than SQL formatting. */
export function databaseSchema(sqlite) {
  const objects = sqlite.prepare("SELECT type, name, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name").all()
  const tables = objects.filter((row) => row.type === 'table' && !ignoredTables.has(row.name))
  return {
    tables: tables.map(({ name }) => ({
      name,
      columns: sqlite.pragma(`table_info(${quote(name)})`).map(({ name, type, notnull, dflt_value, pk }) => ({
        name, type: type.toUpperCase(), notnull, default: dflt_value, pk,
      })).sort((a, b) => a.name.localeCompare(b.name)),
      foreignKeys: Object.values(Object.groupBy(sqlite.pragma(`foreign_key_list(${quote(name)})`), (row) => row.id))
        .map((rows) => rows.sort((a, b) => a.seq - b.seq).map(({ table, from, to, on_update, on_delete, match }) => ({ table, from, to, on_update, on_delete, match })))
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      indexes: sqlite.pragma(`index_list(${quote(name)})`).filter((index) => index.origin !== 'pk')
        .map((index) => ({
          name: index.name, unique: index.unique, partial: index.partial,
          columns: sqlite.pragma(`index_xinfo(${quote(index.name)})`).filter((column) => column.key)
            .map(({ name, desc, coll }) => ({ name, desc, coll })),
          // Preserve expression/partial-index definitions if future migrations add them.
          predicate: index.partial ? objects.find((object) => object.name === index.name)?.sql : undefined,
        })).sort((a, b) => a.name.localeCompare(b.name)),
    })),
    other: objects.filter((row) => row.type === 'view' || row.type === 'trigger'),
  }
}

function sameSchema(actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error('Database schema differs from its recorded migration history. Restore a verified backup or resolve the drift before upgrading.')
  }
}

function assertIntegrity(sqlite) {
  if (sqlite.pragma('integrity_check', { simple: true }) !== 'ok') throw new Error('SQLite integrity_check failed.')
  const violations = sqlite.pragma('foreign_key_check')
  if (violations.length) throw new Error(`SQLite foreign_key_check failed (${violations.length} violations).`)
}

function loadMigrationPlan(migrationsFolder = defaultFolder) {
  const migrations = readMigrationFiles({ migrationsFolder })
  if (!migrations.length) throw new Error('No packaged database migrations found.')
  if (migrations.some((item, index) => index && item.folderMillis <= migrations[index - 1].folderMillis)) {
    throw new Error('Packaged migration timestamps must be strictly increasing.')
  }
  const reference = new Sqlite(':memory:')
  try {
    // Derive the journal contract using the pinned Drizzle migrator itself.
    migrate(drizzle(reference), { migrationsFolder })
    const journalSql = reference.prepare("SELECT sql FROM sqlite_schema WHERE name = '__drizzle_migrations'").get().sql
    const journalColumns = reference.pragma('table_info("__drizzle_migrations")')
    const journalIndexes = reference.pragma('index_list("__drizzle_migrations")')
    const records = reference.prepare('SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at').all()
    const latestSchema = databaseSchema(reference)
    const stages = new Sqlite(':memory:')
    const schemas = []
    try {
      for (const migration of migrations) {
        for (const statement of migration.sql) if (statement.trim()) stages.exec(statement)
        schemas.push(databaseSchema(stages))
      }
    } finally {
      stages.close()
    }
    return { migrations, schemas, latestSchema, journalSql, journalColumns, journalIndexes, records, migrationsFolder }
  } finally {
    reference.close()
  }
}

function hasTable(sqlite, name) {
  return Boolean(sqlite.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ?").get(name))
}

function validatePrismaHistory(sqlite, migrationsFolder) {
  const expected = JSON.parse(readFileSync(join(migrationsFolder, 'legacy-prisma.json'), 'utf8'))
  const rows = sqlite.prepare('SELECT migration_name, checksum, finished_at, rolled_back_at FROM _prisma_migrations').all()
  const completed = rows.filter((row) => row.finished_at !== null && row.rolled_back_at === null)
  const unfinished = rows.some((row) => row.finished_at === null && row.rolled_back_at === null)
  if (unfinished || completed.length !== expected.length || expected.some((migration) => {
    const matches = completed.filter((row) => row.migration_name === migration.name)
    return matches.length !== 1 || !migration.checksums.includes(matches[0].checksum)
  })) {
    throw new Error('Unsupported or incomplete Prisma migration history. Upgrade with the last supported Prisma release before adopting Drizzle.')
  }
}

function inspect(sqlite, plan) {
  const schema = databaseSchema(sqlite)
  if (hasTable(sqlite, '__drizzle_migrations')) {
    if (JSON.stringify(sqlite.pragma('table_info("__drizzle_migrations")')) !== JSON.stringify(plan.journalColumns)
      || sqlite.pragma('foreign_key_list("__drizzle_migrations")').length
      || JSON.stringify(sqlite.pragma('index_list("__drizzle_migrations")')) !== JSON.stringify(plan.journalIndexes)) {
      throw new Error('Unknown Drizzle migration journal structure. Use the image matching this database or restore a verified backup.')
    }
    const rows = sqlite.prepare('SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at').all()
    if (!rows.length || rows.length > plan.records.length || rows.some((row, index) =>
      row.hash !== plan.records[index].hash || Number(row.created_at) !== Number(plan.records[index].created_at))) {
      throw new Error('Unknown or modified Drizzle migration history. Use the image matching this database or restore a verified backup.')
    }
    sameSchema(schema, plan.schemas[rows.length - 1])
    return { state: rows.length === plan.records.length ? 'current' : 'pending', applied: rows.length, pending: plan.records.length - rows.length }
  }
  if (hasTable(sqlite, '_prisma_migrations')) {
    validatePrismaHistory(sqlite, plan.migrationsFolder)
    sameSchema(schema, plan.schemas[0])
    return { state: 'prisma', applied: 0, pending: plan.records.length }
  }
  if (schema.tables.length || schema.other.length) throw new Error('Unrecognized database without migration history; refusing to initialize existing tables.')
  return { state: 'empty', applied: 0, pending: plan.records.length }
}

function normalizeLegacyDates(sqlite, schema) {
  for (const table of schema.tables) {
    for (const column of table.columns.filter((column) => column.type === 'DATETIME')) {
      const rows = sqlite.prepare(`SELECT rowid AS _rowid, ${quote(column.name)} AS value FROM ${quote(table.name)} WHERE ${quote(column.name)} IS NOT NULL`).all()
      const update = sqlite.prepare(`UPDATE ${quote(table.name)} SET ${quote(column.name)} = ? WHERE rowid = ?`)
      for (const row of rows) {
        if (typeof row.value === 'number' && Number.isSafeInteger(row.value) && Number.isFinite(new Date(row.value).getTime())) continue
        if (typeof row.value !== 'string' || !/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.test(row.value)) {
          throw new Error(`Unsupported timestamp in ${table.name}.${column.name}; database was not upgraded.`)
        }
        // Date.parse normalizes dates such as February 30; reject invalid source dates instead of changing their meaning.
        const [year, month, day, hour, minute, second] = row.value.match(/^\d{4}|\d{2}/g).slice(0, 6).map(Number)
        const daysInMonth = new Date(Date.UTC(year + 400, month, 0)).getUTCDate()
        if (month < 1 || month > 12 || day < 1 || day > daysInMonth || hour > 23 || minute > 59 || second > 59) {
          throw new Error(`Invalid timestamp in ${table.name}.${column.name}; database was not upgraded.`)
        }
        const timestamp = Date.parse(/[Zz]|[+-]\d{2}:\d{2}$/.test(row.value) ? row.value : `${row.value.replace(' ', 'T')}Z`)
        if (!Number.isFinite(timestamp)) throw new Error(`Invalid timestamp in ${table.name}.${column.name}; database was not upgraded.`)
        update.run(timestamp, row._rowid)
      }
    }
  }
}

/**
 * The same journal format as Drizzle; one immediate transaction also verifies rebuilt FKs before commit.
 * @param {string} filename
 * @param {MigrationOptions} [options]
 */
export function migrateDatabase(filename, options = {}) {
  const plan = loadMigrationPlan(options.migrationsFolder)
  mkdirSync(dirname(filename), { recursive: true })
  const sqlite = new Sqlite(filename, { timeout: 5000 })
  try {
    // SQLite ignores changes to foreign_keys inside a transaction. Rebuilds must
    // disable it here, then check every constraint before committing any change.
    sqlite.pragma('foreign_keys = OFF')
    const result = sqlite.transaction(() => {
      const status = inspect(sqlite, plan)
      assertIntegrity(sqlite)
      if (status.state === 'current') return { action: 'current', applied: 0 }
      let offset = status.applied
      if (status.state === 'prisma') {
        normalizeLegacyDates(sqlite, plan.schemas[0])
        sqlite.exec(plan.journalSql)
        sqlite.prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)').run(plan.records[0].hash, plan.records[0].created_at)
        offset = 1
      } else if (status.state === 'empty') {
        sqlite.exec(plan.journalSql)
      }
      for (const migration of plan.migrations.slice(offset)) {
        for (const statement of migration.sql) if (statement.trim()) sqlite.exec(statement)
        sqlite.prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)').run(migration.hash, migration.folderMillis)
      }
      sameSchema(databaseSchema(sqlite), plan.latestSchema)
      assertIntegrity(sqlite)
      return { action: status.state === 'prisma' ? 'adopted' : status.state === 'empty' ? 'initialized' : 'migrated', applied: plan.migrations.length - status.applied }
    }).immediate()
    return result
  } finally {
    sqlite.pragma('foreign_keys = ON')
    sqlite.close()
  }
}

/** @param {string} filename @param {MigrationOptions} [options] */
export function getDatabaseStatus(filename, options = {}) {
  if (!existsSync(filename)) return { state: 'missing', applied: 0, pending: null }
  const plan = loadMigrationPlan(options.migrationsFolder)
  const sqlite = new Sqlite(filename, { readonly: true, fileMustExist: true })
  try {
    assertIntegrity(sqlite)
    return inspect(sqlite, plan)
  } finally {
    sqlite.close()
  }
}

/** @param {string} filename @param {MigrationOptions} [options] */
export function checkDatabase(filename, options = {}) {
  const status = getDatabaseStatus(filename, options)
  if (status.state !== 'current') throw new Error(`Database is ${status.state}; run the packaged migrate command before starting with RUN_MIGRATIONS=0.`)
  return status
}

/** @param {string} filename @param {string} destination */
export async function backupDatabase(filename, destination) {
  if (existsSync(destination)) throw new Error('Backup destination already exists; choose a new filename.')
  mkdirSync(dirname(destination), { recursive: true })
  const source = new Sqlite(filename, { readonly: true, fileMustExist: true })
  try {
    await source.backup(destination)
    const backup = new Sqlite(destination, { readonly: true, fileMustExist: true })
    try {
      assertIntegrity(backup)
    } finally {
      backup.close()
    }
  } finally {
    source.close()
  }
  return { backup: destination }
}
