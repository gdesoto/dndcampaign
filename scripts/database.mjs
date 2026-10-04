import 'dotenv/config'
import { resolve } from 'node:path'
import { migrateDatabase, getDatabaseStatus, checkDatabase, backupDatabase } from '../server/db/migrations.mjs'
import { resolveDatabasePath } from '../server/db/sqlite-path.mjs'

try {
  const filename = resolveDatabasePath(process.env.DATABASE_URL)
  const [command, destination, ...extra] = process.argv.slice(2)
  if (extra.length || (destination && command !== 'backup')) throw new Error('Unexpected database command arguments.')
  let result
  switch (command) {
    case 'migrate': result = migrateDatabase(filename); break
    case 'status': result = getDatabaseStatus(filename); break
    case 'check': result = checkDatabase(filename); break
    case 'backup':
      if (!destination) throw new Error('A new backup destination path is required.')
      result = await backupDatabase(filename, resolve(destination))
      break
    default: throw new Error('Usage: node scripts/database.mjs migrate|status|check|backup <destination>')
  }
  console.log(JSON.stringify(result))
} catch (error) {
  console.error(`Database operation failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
