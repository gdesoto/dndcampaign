import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'

const prisma = new PrismaClient()
const hash = new Hash(new Scrypt())

const email = process.env.SEED_USER_EMAIL || 'dm@example.com'
const password = process.env.SEED_USER_PASSWORD || 'password123'

const main = async () => {
  const existingUser = await prisma.user.findUnique({ where: { email } })
  let user = existingUser

  if (!user) {
    const passwordHash = await hash.make(password)
    user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: 'Dungeon Master',
      },
    })
    console.log(`Seeded user: ${email}`)
  }

  const campaignCount = await prisma.campaign.count({
    where: { ownerId: user.id },
  })

  if (campaignCount === 0) {
    await prisma.campaign.create({
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
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
