import { getRequestHeader, sendStream, setHeader, setResponseStatus } from 'h3'
import { prisma } from '#server/db/prisma'
import { fail } from '#server/utils/http'
import { getStorageAdapter } from '#server/services/storage/storage.factory'
import { resolveCampaignAccess } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const artifactId = event.context.params?.artifactId
  if (!artifactId) {
    return fail(400, 'VALIDATION_ERROR', 'Artifact id is required')
  }

  const artifact = await prisma.artifact.findUnique({
    where: { id: artifactId },
  })
  if (!artifact) {
    return fail(404, 'NOT_FOUND', 'Artifact not found')
  }

  if (artifact.ownerId !== sessionUser.user.id) {
    if (!artifact.campaignId) {
      return fail(403, 'FORBIDDEN', 'Artifact access is denied')
    }

    const campaignAccess = await resolveCampaignAccess(
      artifact.campaignId,
      sessionUser.user.id,
      sessionUser.user.systemRole
    )
    const canRead = campaignAccess.access?.permissions.includes('content.read')
    if (!canRead) {
      return fail(403, 'FORBIDDEN', 'Artifact access is denied')
    }
  }

  const adapter = getStorageAdapter()
  const rangeHeader = String(getRequestHeader(event, 'range') || '')
  const supportsRange = typeof adapter.getObjectRange === 'function'
  const supportsInfo = typeof adapter.getObjectInfo === 'function'

  if (rangeHeader && supportsRange && supportsInfo) {
    const match = rangeHeader.match(/bytes=(\d*)-(\d*)/)
    if (match) {
      const startRaw = match[1]
      const endRaw = match[2]
      const objectInfo = await adapter.getObjectInfo(artifact.storageKey)
      const size = objectInfo.size

      if (size != null) {
        let start = startRaw ? Number(startRaw) : 0
        let end = endRaw ? Number(endRaw) : size - 1

        if (!startRaw && endRaw) {
          const suffixLength = Number(endRaw)
          start = Math.max(size - suffixLength, 0)
          end = size - 1
        }

        if (Number.isFinite(start) && Number.isFinite(end) && start <= end) {
          const { stream } = await adapter.getObjectRange(artifact.storageKey, {
            start,
            end,
          })
          setResponseStatus(event, 206)
          setHeader(event, 'Content-Type', artifact.mimeType)
          setHeader(event, 'Accept-Ranges', 'bytes')
          setHeader(event, 'Content-Range', `bytes ${start}-${end}/${size}`)
          setHeader(event, 'Content-Length', `${end - start + 1}`)
          return sendStream(event, stream)
        }
      }
    }
  }

  const { stream, size } = await adapter.getObject(artifact.storageKey)
  setHeader(event, 'Content-Type', artifact.mimeType)
  setHeader(event, 'Accept-Ranges', 'bytes')
  if (size != null) {
    setHeader(event, 'Content-Length', `${size}`)
  }
  return sendStream(event, stream)
})



