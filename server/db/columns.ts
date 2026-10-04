import { sql } from 'drizzle-orm'
import { customType } from 'drizzle-orm/sqlite-core'

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

/** Use this value to store the JSON literal null; ordinary null stores SQL NULL. */
export const jsonNull = sql`'null'`

// Keep Prisma's physical declarations while encoding the values used by its SQLite adapter.
export const dateTime = customType<{ data: Date; driverData: number | string }>({
  dataType: () => 'DATETIME',
  toDriver: (value) => value.getTime(),
  fromDriver: (value) => typeof value === 'number'
    ? new Date(value)
    : new Date(/^\d+$/.test(value) ? Number(value) : /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value.replace(' ', 'T')}Z`),
})

export const booleanColumn = customType<{ data: boolean; driverData: number }>({
  dataType: () => 'BOOLEAN',
  toDriver: (value) => value ? 1 : 0,
  fromDriver: (value) => value !== 0,
})

export const jsonColumn = customType<{ data: JsonValue; driverData: string }>({
  dataType: () => 'JSONB',
  toDriver: (value) => JSON.stringify(value),
  fromDriver: (value) => JSON.parse(value) as JsonValue,
})
