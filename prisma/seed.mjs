import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'

const prisma = new PrismaClient()
const hash = new Hash(new Scrypt())

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

const upsertSeedUser = async ({ email, password, name, systemRole = 'USER' }) => {
  const existingUser = await prisma.user.findUnique({ where: { email } })
  const passwordHash = await hash.make(password)

  if (!existingUser) {
    const created = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        systemRole,
      },
    })
    console.log(`Seeded user: ${email}`)
    return created
  }

  return prisma.user.update({
    where: { id: existingUser.id },
    data: {
      passwordHash,
      name: existingUser.name || name,
      systemRole,
    },
  })
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

  let campaign = await prisma.campaign.findFirst({
    where: { ownerId: user.id },
    orderBy: { createdAt: 'asc' },
  })

  if (!campaign) {
    campaign = await prisma.campaign.create({
      data: {
        ownerId: user.id,
        name: 'The Ashen Vale',
        system: 'D&D 5e',
        description: 'A frontier campaign on the edge of a dying empire.',
        currentStatus: 'The party has just reached the ruined watchtower.',
      },
    })
    console.log('Seeded campaign for user.')
  }

  await prisma.campaignMember.upsert({
    where: {
      campaignId_userId: {
        campaignId: campaign.id,
        userId: user.id,
      },
    },
    update: {
      role: 'OWNER',
      invitedByUserId: user.id,
    },
    create: {
      campaignId: campaign.id,
      userId: user.id,
      role: 'OWNER',
      invitedByUserId: user.id,
    },
  })

  await prisma.campaignMember.upsert({
    where: {
      campaignId_userId: {
        campaignId: campaign.id,
        userId: collaboratorUser.id,
      },
    },
    update: {
      role: 'COLLABORATOR',
      invitedByUserId: user.id,
    },
    create: {
      campaignId: campaign.id,
      userId: collaboratorUser.id,
      role: 'COLLABORATOR',
      invitedByUserId: user.id,
    },
  })

  await prisma.campaignMember.upsert({
    where: {
      campaignId_userId: {
        campaignId: campaign.id,
        userId: viewerUser.id,
      },
    },
    update: {
      role: 'VIEWER',
      invitedByUserId: user.id,
    },
    create: {
      campaignId: campaign.id,
      userId: viewerUser.id,
      role: 'VIEWER',
      invitedByUserId: user.id,
    },
  })

  let character = await prisma.playerCharacter.findFirst({
    where: { ownerId: user.id },
    orderBy: { createdAt: 'asc' },
  })

  if (!character) {
    character = await prisma.playerCharacter.create({
      data: {
        ownerId: user.id,
        name: 'Elyra Dawnshield',
        status: 'Level 3 Paladin',
        sheetJson: {
          level: 3,
          classes: ['Paladin'],
          race: 'Half-Elf',
        },
        summaryJson: {
          level: 3,
          classes: ['Paladin'],
          race: 'Half-Elf',
          background: 'Knight of the Order',
          alignment: 'Lawful Good',
        },
      },
    })
    console.log('Seeded player character.')
  }

  const campaignCharacter = await prisma.campaignCharacter.findFirst({
    where: {
      campaignId: campaign.id,
      characterId: character.id,
    },
  })

  if (!campaignCharacter) {
    await prisma.campaignCharacter.create({
      data: {
        campaignId: campaign.id,
        characterId: character.id,
      },
    })
    console.log('Linked player character to campaign.')
  }

  let session = await prisma.session.findFirst({
    where: { campaignId: campaign.id },
    orderBy: { createdAt: 'asc' },
  })

  if (!session) {
    session = await prisma.session.create({
      data: {
        campaignId: campaign.id,
        title: 'Session 1: The Ruined Watchtower',
        sessionNumber: 1,
        notes: 'The party explored the tower and recovered a sealed map case.',
      },
    })
    console.log('Seeded campaign session.')
  }

  const transcriptDocument = await prisma.document.findFirst({
    where: {
      sessionId: session.id,
      type: 'TRANSCRIPT',
    },
    select: { id: true },
  })

  if (!transcriptDocument) {
    await prisma.$transaction(async (tx) => {
      const document = await tx.document.create({
        data: {
          campaignId: campaign.id,
          sessionId: session.id,
          type: 'TRANSCRIPT',
          title: `Transcript: ${session.title}`,
        },
      })

      const version = await tx.documentVersion.create({
        data: {
          documentId: document.id,
          versionNumber: 1,
          content: seedTranscriptContent,
          format: 'PLAINTEXT',
          source: 'USER_EDIT',
          createdByUserId: user.id,
        },
      })

      await tx.document.update({
        where: { id: document.id },
        data: { currentVersionId: version.id },
      })
    })
    console.log('Seeded transcript document for first session.')
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
