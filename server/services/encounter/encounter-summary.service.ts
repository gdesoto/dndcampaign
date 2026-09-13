import { buildEncounterSummary } from '#shared/utils/encounter-summary'
import type { EncounterSummaryReport } from '#shared/types/encounter'
import { getEncounterWithAccess } from '#server/services/encounter/encounter-shared'
import { apiError } from '#server/utils/http'

export class EncounterSummaryService {
  async getSummary(encounterId: string, userId: string): Promise<EncounterSummaryReport> {
    const encounter = await getEncounterWithAccess(encounterId, userId, 'content.read')
    if (!encounter) {
      throw apiError(404, 'NOT_FOUND', 'Encounter not found or access denied.')
    }

    return buildEncounterSummary(encounter)
  }
}
