import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

export class SqliteAdapter extends PrismaBetterSqlite3 {
  override async connect() {
    const adapter = await super.connect()
    const startTransaction = adapter.startTransaction.bind(adapter)

    adapter.startTransaction = async isolationLevel => {
      const transaction = await startTransaction(isolationLevel)
      try {
        // Prisma's adapter uses deferred BEGIN and has no transaction-mode option.
        // While its mutex is held, replace the still-empty transaction with one
        // that acquires the writer lock before any reads. Otherwise a competing
        // connection can make a later read-to-write upgrade fail with SQLITE_BUSY.
        await transaction.executeRaw({ sql: 'ROLLBACK', args: [], argTypes: [] })
        await transaction.executeRaw({ sql: 'BEGIN IMMEDIATE', args: [], argTypes: [] })
        return transaction
      } catch (error) {
        // BEGIN IMMEDIATE may fail to acquire the lock. Release Prisma's mutex so
        // the connection remains usable; there is no active transaction to undo.
        await transaction.rollback()
        throw error
      }
    }

    return adapter
  }
}
