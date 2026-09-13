import { SessionWorkspaceService } from '#server/services/session-workspace.service'
import { ok, apiError, routeParams } from '#server/utils/http'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const { sessionId } = routeParams(event, 'sessionId')

  const workspace = await new SessionWorkspaceService().getWorkspace(
    sessionId,
    sessionUser.user.id,
    sessionUser.user.systemRole
  )
  if (!workspace) {
    throw apiError(404, 'NOT_FOUND', 'Session not found')
  }

  return ok(workspace)
})
