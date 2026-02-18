import { SessionWorkspaceService } from '#server/services/session-workspace.service'
import { ok, fail } from '#server/utils/http'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const sessionId = event.context.params?.sessionId
  if (!sessionId) {
    return fail(400, 'VALIDATION_ERROR', 'Session id is required')
  }

  const workspace = await new SessionWorkspaceService().getWorkspace(
    sessionId,
    sessionUser.user.id,
    sessionUser.user.systemRole
  )
  if (!workspace) {
    return fail(404, 'NOT_FOUND', 'Session not found')
  }

  return ok(workspace)
})
