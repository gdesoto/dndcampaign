import { createDatabase } from '../../server/db/connection'
import { getApiTestDatabaseUrl } from './api-test-context.mjs'

export const createApiTestDatabase = () => createDatabase(getApiTestDatabaseUrl())
