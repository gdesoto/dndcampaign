import { db } from '#server/db/client'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('close', () => {
    if (db.$client.open) db.$client.close()
  })
})
