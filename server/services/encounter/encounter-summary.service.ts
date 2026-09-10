import { buildEncounterSummary } from '#shared/utils/encounter-summary'
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

    return { ok: true, data: buildEncounterSummary(encounter) }
  }
}
