import { ok, routeParams } from '#server/utils/http'
import { requireArtifactReadAccess } from '#server/utils/artifact-auth'

export default defineEventHandler(async (event) => {
  const { artifactId } = routeParams(event, 'artifactId')

  return ok(await requireArtifactReadAccess(event, artifactId))
})



