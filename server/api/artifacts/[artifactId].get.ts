import { ok, fail } from '#server/utils/http'
import { requireArtifactReadAccess } from '#server/utils/artifact-auth'

export default defineEventHandler(async (event) => {
  const artifactId = event.context.params?.artifactId
  if (!artifactId) {
    return fail(400, 'VALIDATION_ERROR', 'Artifact id is required')
  }

  const access = await requireArtifactReadAccess(event, artifactId)
  if (!access.ok) {
    return access.response
  }

  return ok(access.artifact)
})



