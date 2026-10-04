import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import { expect, it } from 'vitest'
import { createDatabase } from '../../server/db/connection'

it('reserves write access before reads and recovers after contention and rollback', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dm-vault-sqlite-'))
  const filename = join(directory, 'test.db')
  const first = createDatabase(filename, { timeout: 0 })
  const second = createDatabase(filename, { timeout: 0 })
  try {
    first.run(sql`CREATE TABLE entries (id INTEGER PRIMARY KEY)`)
    first.transaction((writer) => {
      let enteredSecondTransaction = false
      // BEGIN IMMEDIATE excludes another writer before this callback reads or writes.
      expect(() => second.transaction(() => {
        enteredSecondTransaction = true
      }, { behavior: 'immediate' })).toThrow(/locked/)
      expect(enteredSecondTransaction).toBe(false)
      writer.all(sql`SELECT * FROM entries`)
      writer.run(sql`INSERT INTO entries VALUES (1)`)
    }, { behavior: 'immediate' })

    // Both the failed BEGIN and a callback failure must leave the connection usable.
    const failure = new Error('roll back this write')
    expect(() => second.transaction((writer) => {
      writer.run(sql`INSERT INTO entries VALUES (2)`)
      throw failure
    }, { behavior: 'immediate' })).toThrow(failure)
    second.transaction((writer) => {
      writer.run(sql`INSERT INTO entries VALUES (3)`)
    }, { behavior: 'immediate' })
    expect(first.all<{ id: number }>(sql`SELECT id FROM entries ORDER BY id`)).toEqual([{ id: 1 }, { id: 3 }])
  } finally {
    first.$client.close()
    second.$client.close()
    await rm(directory, { recursive: true, force: true })
  }
})
