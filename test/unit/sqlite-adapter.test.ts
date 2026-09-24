import { mkdtemp, rm, rmdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { SqliteAdapter } from '../../server/db/sqlite-adapter'

it('reserves write access before reads and recovers after contention and rollback', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dm-vault-sqlite-'))
  const path = join(directory, 'test.db')
  const first = await new SqliteAdapter({ url: path, timeout: 0 }).connect()
  const second = await new SqliteAdapter({ url: path, timeout: 0 }).connect()
  const query = (sql: string) => ({ sql, args: [], argTypes: [] })
  try {
    await first.executeRaw(query('CREATE TABLE entries (id INTEGER PRIMARY KEY)'))
    const writer = await first.startTransaction()
    // No query has run in this transaction, but another writer must already be excluded.
    await expect(second.startTransaction()).rejects.toMatchObject({
      cause: { originalCode: 'SQLITE_BUSY' },
    })
    await writer.queryRaw(query('SELECT * FROM entries'))
    await writer.executeRaw(query('INSERT INTO entries VALUES (1)'))
    await writer.executeRaw(query('COMMIT'))
    await writer.commit()

    // A failed BEGIN must release the adapter mutex, allowing later transactions.
    const rolledBack = await second.startTransaction()
    await rolledBack.executeRaw(query('INSERT INTO entries VALUES (2)'))
    await rolledBack.executeRaw(query('ROLLBACK'))
    await rolledBack.rollback()
    const committed = await second.startTransaction()
    await committed.executeRaw(query('INSERT INTO entries VALUES (3)'))
    await committed.executeRaw(query('COMMIT'))
    await committed.commit()
    const rows = await first.queryRaw(query('SELECT id FROM entries ORDER BY id'))
    expect(rows.rows.map(([id]) => Number(id))).toEqual([1, 3])
  } finally {
    await first.dispose()
    await second.dispose()
    await rm(path, { force: true })
    await rmdir(directory)
  }
})
