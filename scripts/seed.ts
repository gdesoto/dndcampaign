import 'dotenv/config'
import { and, asc, eq } from 'drizzle-orm'
import { createDatabase } from '../server/db/connection'
import * as schema from '../server/db/schema'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run the database seed.')
}

const db = createDatabase(databaseUrl)
const hash = new Hash(new Scrypt({}))

const email = process.env.SEED_USER_EMAIL || 'dm@example.com'
const password = process.env.SEED_USER_PASSWORD || 'password123'
const collaboratorEmail = process.env.SEED_COLLABORATOR_EMAIL || 'collaborator@example.com'
const collaboratorPassword = process.env.SEED_COLLABORATOR_PASSWORD || 'password123'
const viewerEmail = process.env.SEED_VIEWER_EMAIL || 'viewer@example.com'
const viewerPassword = process.env.SEED_VIEWER_PASSWORD || 'password123'
const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@example.com'
const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'password123'

const seedTranscriptContent = `Welcome to the session transcript.

[00:00] DM: The ruined watchtower rises over the ridge.
[00:07] Player: We should scout for tracks before entering.`

const upsertSeedUser = async ({ email, password, name, systemRole = 'USER' }: {
  email: string
  password: string
  name: string
  systemRole?: schema.UserSystemRole
}) => {
  const existingUser = db.select().from(schema.user).where(eq(schema.user.email, email)).get()
  const passwordHash = await hash.make(password)

  if (!existingUser) {
    const created = db.insert(schema.user).values({
        email,
        passwordHash,
        name,
        systemRole,
      }).returning().get()!
    console.log(`Seeded user: ${email}`)
    return created
  }

  return db.update(schema.user).set({
      passwordHash,
      name: existingUser.name || name,
      systemRole,
    }).where(eq(schema.user.id, existingUser.id)).returning().get()!
}

const main = async () => {
  const user = await upsertSeedUser({
    email,
    password,
    name: 'Dungeon Master',
  })
  const collaboratorUser = await upsertSeedUser({
    email: collaboratorEmail,
    password: collaboratorPassword,
    name: 'Campaign Collaborator',
  })
  const viewerUser = await upsertSeedUser({
    email: viewerEmail,
    password: viewerPassword,
    name: 'Campaign Viewer',
  })
  await upsertSeedUser({
    email: adminEmail,
    password: adminPassword,
    name: 'System Admin',
    systemRole: 'SYSTEM_ADMIN',
  })

  let campaign = db.select().from(schema.campaign).where(eq(schema.campaign.ownerId, user.id)).orderBy(asc(schema.campaign.createdAt)).get()

  if (!campaign) {
    campaign = db.insert(schema.campaign).values({
        ownerId: user.id,
        name: 'The Ashen Vale',
        system: 'D&D 5e',
        description: 'A frontier campaign on the edge of a dying empire.',
        currentStatus: 'The party has just reached the ruined watchtower.',
      }).returning().get()!
    console.log('Seeded campaign for user.')
  }

  db.insert(schema.campaignMember).values({
      campaignId: campaign.id,
      userId: user.id,
      role: 'OWNER',
      invitedByUserId: user.id,
    }).onConflictDoUpdate({ target: [schema.campaignMember.campaignId, schema.campaignMember.userId], set: {
      role: 'OWNER',
      invitedByUserId: user.id,
    } }).returning().get()!

  db.insert(schema.campaignMember).values({
      campaignId: campaign.id,
      userId: collaboratorUser.id,
      role: 'COLLABORATOR',
      invitedByUserId: user.id,
    }).onConflictDoUpdate({ target: [schema.campaignMember.campaignId, schema.campaignMember.userId], set: {
      role: 'COLLABORATOR',
      invitedByUserId: user.id,
    } }).returning().get()!

  db.insert(schema.campaignMember).values({
      campaignId: campaign.id,
      userId: viewerUser.id,
      role: 'VIEWER',
      invitedByUserId: user.id,
    }).onConflictDoUpdate({ target: [schema.campaignMember.campaignId, schema.campaignMember.userId], set: {
      role: 'VIEWER',
      invitedByUserId: user.id,
    } }).returning().get()!

  let character = db.select().from(schema.playerCharacter).where(eq(schema.playerCharacter.ownerId, user.id)).orderBy(asc(schema.playerCharacter.createdAt)).get()

  if (!character) {
    character = db.insert(schema.playerCharacter).values({
        ownerId: user.id,
        name: 'Elyra Dawnshield',
        status: 'Level 3 Paladin',
        sheetJson: {
          basics: {
            name: 'Elyra Dawnshield',
            level: 3,
            alignment: 'Lawful Good',
          },
          classes: [{ name: 'Paladin', level: 3 }],
          race: { name: 'Half-Elf' },
          background: { name: 'Knight of the Order' },
        },
        summaryJson: {
          level: 3,
          classes: ['Paladin'],
          race: 'Half-Elf',
          background: 'Knight of the Order',
          alignment: 'Lawful Good',
        },
      }).returning().get()!
    console.log('Seeded player character.')
  }

  const campaignCharacter = db.select().from(schema.campaignCharacter).where(and(eq(schema.campaignCharacter.campaignId, campaign.id), eq(schema.campaignCharacter.characterId, character.id))).get()

  if (!campaignCharacter) {
    db.insert(schema.campaignCharacter).values({
        campaignId: campaign.id,
        characterId: character.id,
      }).returning().get()!
    console.log('Linked player character to campaign.')
  }

  let session = db.select().from(schema.session).where(eq(schema.session.campaignId, campaign.id)).orderBy(asc(schema.session.createdAt)).get()

  if (!session) {
    session = db.insert(schema.session).values({
        campaignId: campaign.id,
        title: 'Session 1: The Ruined Watchtower',
        sessionNumber: 1,
        notes: 'The party explored the tower and recovered a sealed map case.',
      }).returning().get()!
    console.log('Seeded campaign session.')
  }

  const transcriptDocument = db.select({ id: schema.document.id }).from(schema.document).where(and(eq(schema.document.sessionId, session.id), eq(schema.document.type, 'TRANSCRIPT'))).get()

  if (!transcriptDocument) {
    db.transaction((tx) => {
      const document = tx.insert(schema.document).values({
          campaignId: campaign.id,
          sessionId: session.id,
          type: 'TRANSCRIPT',
          title: `Transcript: ${session.title}`,
        }).returning().get()!

      const version = tx.insert(schema.documentVersion).values({
          documentId: document.id,
          versionNumber: 1,
          content: seedTranscriptContent,
          format: 'PLAINTEXT',
          source: 'USER_EDIT',
          createdByUserId: user.id,
        }).returning().get()!

      tx.update(schema.document).set({ currentVersionId: version.id }).where(eq(schema.document.id, document.id)).returning().get()!
    }, { behavior: 'immediate' })
    console.log('Seeded transcript document for first session.')
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => {
    db.$client.close()
  })
