import { getRequestHeader, sendStream, setHeader, setResponseStatus } from 'h3'
import { getStorageAdapter } from '#server/services/storage/storage.factory'
import { requireArtifactReadAccess } from '#server/utils/artifact-auth'
import { getMediaStream } from '#server/utils/media-stream'
import { apiError, routeParams } from '#server/utils/http'

export default defineEventHandler(async (event) => {
  const { artifactId } = routeParams(event, 'artifactId')

  const artifact = await requireArtifactReadAccess(event, artifactId)

  const adapter = getStorageAdapter()
  const result = await getMediaStream(adapter, artifact.storageKey, getRequestHeader(event, 'range'))

  for (const [name, value] of Object.entries(result.headers)) {
    setHeader(event, name, value)
  }

  if (result.statusCode === 416) {
    throw apiError(416, 'RANGE_NOT_SATISFIABLE', 'Requested range is not satisfiable.')
  }

  setResponseStatus(event, result.statusCode)
  setHeader(event, 'Content-Type', artifact.mimeType)
  return result.body ? sendStream(event, result.body) : ''
})



