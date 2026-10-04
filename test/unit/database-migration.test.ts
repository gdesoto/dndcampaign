import { createHash, randomUUID } from 'node:crypto'
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Sqlite from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { createDatabase } from '../../server/db/connection'
import { user } from '../../server/db/schema'
import { backupDatabase, checkDatabase, getDatabaseStatus, migrateDatabase } from '../../server/db/migrations.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const migrationsFolder = join(projectRoot, 'drizzle')
const temporaryDirectories: string[] = []
const textDate = '2026-02-19 12:30:00'
const textDateMs = Date.parse('2026-02-19T12:30:00Z')
const numericDate = 1771504200123

afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) await rm(directory, { recursive: true, force: true })
})

const temporaryDirectory = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dm-vault-migrations-'))
  temporaryDirectories.push(directory)
  return directory
}

const readDatabase = <T>(filename: string, read: (db: Sqlite.Database) => T): T => {
  const db = new Sqlite(filename, { readonly: true, fileMustExist: true })
  try { return read(db) } finally { db.close() }
}

type Column = { name: string; type: string }
const applicationTables = (db: Sqlite.Database) => (db.prepare(
  "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('_prisma_migrations', '__drizzle_migrations') ORDER BY name",
).all() as Array<{ name: string }>).map(({ name }) => name)

const content = (db: Sqlite.Database, normalizeDates = false) => Object.fromEntries(applicationTables(db).map((table) => {
  const dateColumns = (db.prepare(`PRAGMA table_info("${table}")`).all() as Column[])
    .filter((column) => column.type.toUpperCase() === 'DATETIME').map((column) => column.name)
  const rows = db.prepare(`SELECT * FROM "${table}" ORDER BY rowid`).all() as Array<Record<string, unknown>>
  if (normalizeDates) for (const row of rows) for (const column of dateColumns) {
    const value = row[column]
    if (typeof value === 'string') row[column] = Date.parse(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`)
  }
  return [table, rows]
}))

const physicalSchema = (db: Sqlite.Database) => Object.fromEntries(applicationTables(db).map((table) => {
  const indexes = db.prepare(`PRAGMA index_list("${table}")`).all() as Array<{ name: string; unique: number; origin: string; partial: number }>
  const columns = db.prepare(`PRAGMA table_info("${table}")`).all() as Array<Column & { notnull: number; dflt_value: unknown; pk: number }>
  const foreignKeys = db.prepare(`PRAGMA foreign_key_list("${table}")`).all() as Array<Record<string, unknown>>
  return [table, {
    columns: columns.map(({ name, type, notnull, dflt_value, pk }) => ({ name, type: type.toUpperCase(), notnull, dflt_value, pk }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    foreignKeys: foreignKeys.map(({ id: _id, ...key }) => key).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    indexes: indexes.map(({ name, unique, origin, partial }) => ({
      name, unique, origin, partial, columns: (db.prepare(`PRAGMA index_info("${name}")`).all() as Array<{ seqno: number; name: string }>)
        .map(({ seqno, name }) => ({ seqno, name })),
    })).sort((a, b) => a.name.localeCompare(b.name)),
  }]
}))

const legacyDatabase = async (filename: string) => {
  const db = new Sqlite(filename)
  try {
    db.exec(`CREATE TABLE _prisma_migrations (
      id TEXT NOT NULL PRIMARY KEY, checksum TEXT NOT NULL, finished_at DATETIME,
      migration_name TEXT NOT NULL, logs TEXT, rolled_back_at DATETIME,
      started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, applied_steps_count INTEGER NOT NULL DEFAULT 0
    )`)
    const directory = join(projectRoot, 'prisma/migrations')
    const names = (await readdir(directory, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
    for (const name of names) {
      const migration = await readFile(join(directory, name, 'migration.sql'), 'utf8')
      db.exec(migration)
      db.prepare('INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, started_at, applied_steps_count) VALUES (?, ?, ?, ?, ?, 1)')
        .run(randomUUID(), createHash('sha256').update(migration).digest('hex'), numericDate, name, numericDate)
    }
    db.pragma('foreign_keys = ON')
    db.prepare('INSERT INTO User (id, email, name, passwordHash, createdAt, updatedAt, lastLoginAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('migration-user', 'migration@example.com', 'Migration DM', 'preserved-password-hash', textDate, numericDate, null)
    db.prepare('INSERT INTO User (id, email, name, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)')
      .run('earlier-user', 'earlier@example.com', 'Earlier DM', textDateMs - 1000, numericDate)
    db.prepare('INSERT INTO User (id, email, name, updatedAt) VALUES (?, ?, ?, ?)')
      .run('default-date-user', 'default-date@example.com', 'SQL Default DM', numericDate)
    db.prepare('INSERT INTO Campaign (id, ownerId, name, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)')
      .run('migration-campaign', 'migration-user', 'Preserved Campaign', numericDate, textDate)
    db.prepare('INSERT INTO CampaignMember (id, campaignId, userId, role, invitedByUserId, updatedAt) VALUES (?, ?, ?, ?, ?, ?)')
      .run('migration-member', 'migration-campaign', 'migration-user', 'OWNER', 'migration-user', numericDate)
    db.prepare('INSERT INTO Document (id, campaignId, type, title, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)')
      .run('migration-document', 'migration-campaign', 'TRANSCRIPT', 'Preserved Transcript', textDate, numericDate)
    db.prepare('INSERT INTO DocumentVersion (id, documentId, versionNumber, content, createdByUserId, createdAt) VALUES (?, ?, ?, ?, ?, ?)')
      .run('migration-version', 'migration-document', 1, 'The party explored the watchtower.\nUnicode: é ⚔', 'migration-user', numericDate)
    db.prepare('UPDATE Document SET currentVersionId = ? WHERE id = ?').run('migration-version', 'migration-document')
    db.prepare('INSERT INTO Artifact (id, ownerId, campaignId, provider, storageKey, mimeType, byteSize, meta, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('migration-artifact', 'migration-user', 'migration-campaign', 'LOCAL', 'campaigns/old/recording.mp3', 'audio/mpeg', 42, '{"sessionId":"old-session","label":"é"}', textDate)
    for (const [id, metadata] of [['sql-null', null], ['json-null', 'null'], ['json-object', '{"nested":{"preserved":true},"values":[1,"é"]}']] as const) {
      db.prepare('INSERT INTO ActivityLog (id, actorUserId, campaignId, scope, action, metadata, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(id, 'migration-user', 'migration-campaign', 'CAMPAIGN', 'MIGRATION_FIXTURE', metadata, numericDate)
    }
    expect(db.pragma('foreign_key_check')).toEqual([])
  } finally { db.close() }
}

describe('database migration and recovery', () => {
  it('adopts the frozen legacy database preserving all rows, dates, JSON, circular links, and restart behavior', { timeout: 60_000 }, async () => {
    const directory = await temporaryDirectory()
    const filename = join(directory, 'legacy.db')
    const freshFilename = join(directory, 'fresh.db')
    await legacyDatabase(filename)
    const before = readDatabase(filename, (db) => content(db, true))
    const oldHistory = readDatabase(filename, (db) => db.prepare('SELECT * FROM _prisma_migrations ORDER BY migration_name').all())
    const beforeCheck = await readFile(filename)
    expect(() => checkDatabase(filename)).toThrow()
    expect(getDatabaseStatus(filename)).toMatchObject({ state: 'prisma', applied: 0 })
    expect(await readFile(filename)).toEqual(beforeCheck)

    expect(migrateDatabase(filename)).toMatchObject({ action: 'adopted' })
    expect(() => checkDatabase(filename)).not.toThrow()
    expect(readDatabase(filename, (db) => content(db))).toEqual(before)
    expect(readDatabase(filename, (db) => db.prepare('SELECT * FROM _prisma_migrations ORDER BY migration_name').all())).toEqual(oldHistory)
    readDatabase(filename, (db) => {
      expect(db.pragma('integrity_check')).toEqual([{ integrity_check: 'ok' }])
      expect(db.pragma('foreign_key_check')).toEqual([])
      expect(db.prepare('SELECT createdAt, updatedAt, lastLoginAt FROM User WHERE id = ?').get('migration-user'))
        .toEqual({ createdAt: textDateMs, updatedAt: numericDate, lastLoginAt: null })
      expect(db.prepare('SELECT id FROM User WHERE createdAt <= ? ORDER BY createdAt').all(textDateMs))
        .toEqual([{ id: 'earlier-user' }, { id: 'migration-user' }])
      expect(db.prepare('SELECT metadata, typeof(metadata) AS storageType FROM ActivityLog ORDER BY id').all()).toEqual([
        { metadata: 'null', storageType: 'text' },
        { metadata: '{"nested":{"preserved":true},"values":[1,"é"]}', storageType: 'text' },
        { metadata: null, storageType: 'null' },
      ])
    })
    const readyBytes = await readFile(filename)
    expect(migrateDatabase(filename)).toEqual({ action: 'current', applied: 0 })
    checkDatabase(filename)
    expect(getDatabaseStatus(filename)).toMatchObject({ state: 'current', pending: 0 })
    expect(await readFile(filename)).toEqual(readyBytes)

    expect(migrateDatabase(freshFilename)).toMatchObject({ action: 'initialized' })
    expect(readDatabase(freshFilename, physicalSchema)).toEqual(readDatabase(filename, physicalSchema))
    const db = createDatabase(freshFilename)
    try {
      const row = db.insert(user).values({ email: 'fresh@example.com', name: 'Fresh DM' }).returning().get()!
      expect(row.id).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i)
      expect(row.createdAt).toBeInstanceOf(Date)
      expect(row.updatedAt).toBeInstanceOf(Date)
      db.$client.prepare('INSERT INTO ActivityLog (id, scope, action) VALUES (?, ?, ?)').run('raw-date-default', 'SYSTEM', 'TEST')
      expect(db.$client.prepare('SELECT typeof(createdAt) AS storageType FROM ActivityLog WHERE id = ?').get('raw-date-default'))
        .toEqual({ storageType: 'integer' })
    } finally { db.$client.close() }

    const backupFilename = join(directory, 'backup.db')
    await backupDatabase(filename, backupFilename)
    const restoredFilename = join(directory, 'restored.db')
    await cp(backupFilename, restoredFilename)
    checkDatabase(restoredFilename)
    expect(readDatabase(restoredFilename, content)).toEqual(readDatabase(filename, content))
    expect(readDatabase(restoredFilename, (db) => db.pragma('foreign_key_check'))).toEqual([])
  })

  it('rejects unsupported history, schema drift, incomplete history, and unparseable dates without changing rows', { timeout: 60_000 }, async () => {
    const directory = await temporaryDirectory()
    const source = join(directory, 'legacy-source.db')
    await legacyDatabase(source)
    for (const [name, corruption] of [
      ['unknown-history', "UPDATE _prisma_migrations SET checksum = 'unknown' WHERE migration_name = (SELECT MIN(migration_name) FROM _prisma_migrations)"],
      ['partial-history', 'UPDATE _prisma_migrations SET finished_at = NULL WHERE migration_name = (SELECT MAX(migration_name) FROM _prisma_migrations)'],
      ['missing-history', 'DELETE FROM _prisma_migrations WHERE migration_name = (SELECT MAX(migration_name) FROM _prisma_migrations)'],
      ['schema-drift', 'ALTER TABLE User ADD COLUMN unexpected TEXT'],
      ['invalid-date', "UPDATE User SET createdAt = 'not-a-date'"],
    ]) {
      const filename = join(directory, `${name}.db`)
      await cp(source, filename)
      const db = new Sqlite(filename)
      try { db.exec(corruption!) } finally { db.close() }
      const before = readDatabase(filename, (handle) => content(handle))
      expect(() => migrateDatabase(filename), name).toThrow()
      expect(() => checkDatabase(filename), name).toThrow()
      expect(readDatabase(filename, (handle) => content(handle)), name).toEqual(before)
    }
    const unknown = join(directory, 'unknown.db')
    const db = new Sqlite(unknown)
    try { db.exec('CREATE TABLE unexpected (id INTEGER PRIMARY KEY); INSERT INTO unexpected VALUES (7)') } finally { db.close() }
    expect(() => migrateDatabase(unknown)).toThrow()
    expect(readDatabase(unknown, (handle) => handle.prepare('SELECT * FROM unexpected').all())).toEqual([{ id: 7 }])
  })

  it('rolls back a failed pending migration, rejects unknown Drizzle history, and can retry with corrected artifacts', { timeout: 60_000 }, async () => {
    const directory = await temporaryDirectory()
    const filename = join(directory, 'pending.db')
    migrateDatabase(filename)
    const db = createDatabase(filename)
    try { db.insert(user).values({ id: 'kept-user', email: 'kept@example.com', name: 'Kept DM' }).run() } finally { db.$client.close() }
    const before = readDatabase(filename, (handle) => content(handle))
    const copiedFolder = join(directory, 'migrations')
    await cp(migrationsFolder, copiedFolder, { recursive: true })
    const journalFilename = join(copiedFolder, 'meta/_journal.json')
    const journal = JSON.parse(await readFile(journalFilename, 'utf8'))
    const last = journal.entries.at(-1)
    journal.entries.push({ idx: last.idx + 1, version: last.version, when: last.when + 1000, tag: '0002_recovery_test', breakpoints: true })
    await writeFile(journalFilename, JSON.stringify(journal))
    const migrationFilename = join(copiedFolder, '0002_recovery_test.sql')
    // This applies to an empty reference schema, then fails against the existing user.
    await writeFile(migrationFilename, `CREATE TABLE recovery_probe (id INTEGER PRIMARY KEY);\n--> statement-breakpoint\nINSERT INTO User (id, email, name, updatedAt) VALUES ('kept-user', 'duplicate@example.com', 'Duplicate DM', ${numericDate});`)
    expect(() => checkDatabase(filename, { migrationsFolder: copiedFolder })).toThrow()
    expect(() => migrateDatabase(filename, { migrationsFolder: copiedFolder })).toThrow()
    expect(readDatabase(filename, (handle) => content(handle))).toEqual(before)
    expect(readDatabase(filename, (handle) => handle.prepare("SELECT name FROM sqlite_master WHERE name = 'recovery_probe'").get())).toBeUndefined()
    checkDatabase(filename)
    await writeFile(migrationFilename, "UPDATE User SET name = 'Recovered DM' WHERE id = 'kept-user';")
    expect(migrateDatabase(filename, { migrationsFolder: copiedFolder })).toEqual({ action: 'migrated', applied: 1 })
    expect(() => checkDatabase(filename, { migrationsFolder: copiedFolder })).not.toThrow()
    expect(() => checkDatabase(filename)).toThrow()
    expect(() => migrateDatabase(filename)).toThrow()
    expect(readDatabase(filename, (handle) => handle.prepare('SELECT id, name FROM User').all())).toEqual([{ id: 'kept-user', name: 'Recovered DM' }])
  })
})
