import { getQuery } from 'h3'
import { CampaignWorkspaceService } from '#server/services/campaign-workspace.service'
import { ok, fail } from '#server/utils/http'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const campaignId = event.context.params?.campaignId
  if (!campaignId) {
    return fail(400, 'VALIDATION_ERROR', 'Campaign id is required')
  }

  const query = getQuery(event)
  const sessionId = typeof query.sessionId === 'string' && query.sessionId
    ? query.sessionId
    : undefined

  const workspace = await new CampaignWorkspaceService().getWorkspace(
    campaignId,
    sessionUser.user.id,
    sessionId
  )
  if (!workspace) {
    return fail(404, 'NOT_FOUND', 'Campaign not found')
  }

  return ok(workspace)
})
