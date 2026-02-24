import { prisma } from '#server/db/prisma'
import type { ServiceResult } from '#server/services/auth.service'
import type { EncounterSummaryReport } from '#shared/types/encounter'
import { getEncounterWithAccess } from '#server/services/encounter/encounter-shared'

export class EncounterSummaryService {
  async getSummary(encounterId: string, userId: string): Promise<ServiceResult<EncounterSummaryReport>> {
    const encounter = await getEncounterWithAccess(encounterId, userId, 'content.read')
    if (!encounter) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Encounter not found or access denied.',
      }
    }

    const events = await prisma.encounterEvent.findMany({
      where: { encounterId },
      select: { payload: true },
    })

    let totalDamage = 0
    let totalHealing = 0

    for (const event of events) {
      const payload = (event.payload || null) as Record<string, unknown> | null
      const action = payload?.action
      const amount = typeof payload?.amount === 'number' ? payload.amount : 0
      if (action === 'hp.damage') {
        totalDamage += amount
      }
      if (action === 'hp.heal') {
        totalHealing += amount
      }
    }

    const defeatedCombatants = encounter.combatants.filter((combatant) => combatant.isDefeated).length

    return {
      ok: true,
      data: {
        encounterId,
        rounds: encounter.currentRound,
        totalEvents: encounter.events.length,
        totalDamage,
        totalHealing,
        defeatedCombatants,
      },
    }
  }
}