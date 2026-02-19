const requireEnv = (name) => {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is not set. Did API global setup run?`)
  }
  return value
}

export const getApiTestBaseUrl = () => requireEnv('API_TEST_BASE_URL')
export const getApiTestDatabaseUrl = () => requireEnv('API_TEST_DATABASE_URL')
