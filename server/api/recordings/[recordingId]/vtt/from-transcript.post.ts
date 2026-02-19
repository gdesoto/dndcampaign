import { Readable } from 'node:stream'
import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { RecordingService } from '#server/services/recording.service'
import {
  isSegmentedTranscript,
  parseTranscriptSegments,
  segmentsToVtt,
} from '#shared/utils/transcript'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

const srtToVtt = (input: string) => {
  const normalized = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  if (!normalized) return 'WEBVTT\n'

  const lines = normalized.split('\n')
  const output: string[] = ['WEBVTT', '']
  const timePattern =
    /^(\d{2}:\d{2}:\d{2}),(\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}),(\d{3})(.*)$/
  let pendingPrefix = ''

  for (let i = 0; i < lines.length; i += 1) {
    const currentLine = lines[i] ?? ''
    const line = currentLine.trim()
    if (!line) {
      pendingPrefix = ''
      output.push('')
      continue
    }
    if (/^\d+$/.test(line)) {
      continue
    }
    if (line.includes('-->')) {
      const match = line.match(timePattern)
      if (match) {
        const [, startBase, startMs, endBase, endMs, rest] = match
        const suffix = rest?.trim() || ''
        pendingPrefix = suffix
        output.push(`${startBase}.${startMs} --> ${endBase}.${endMs}`)
      } else {
        output.push(line.replace(/,/g, '.'))
      }
      continue
    }
    if (pendingPrefix) {
      output.push(`${pendingPrefix} ${currentLine.trim()}`.trim())
      pendingPrefix = ''
      continue
    }
    output.push(currentLine)
  }

  return output.join('\n').replace(/\n{3,}/g, '\n\n')
}

const normalizeVtt = (content: string) => {
  const trimmed = content.trim()
  if (!trimmed) return 'WEBVTT\n'
  if (/^WEBVTT/i.test(trimmed)) {
    return trimmed
  }
  return `WEBVTT\n\n${trimmed}`
}

const isLikelySrt = (content: string) =>
  /-->\s*\d{2}:\d{2}:\d{2},\d{3}/.test(content) || /\d{2}:\d{2}:\d{2},\d{3}\s*-->/.test(content)

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const recordingId = event.context.params?.recordingId
  if (!recordingId) {
    return fail(400, 'VALIDATION_ERROR', 'Recording id is required')
  }

  const recording = await prisma.recording.findFirst({
    where: {
      id: recordingId,
      session: { campaign: buildCampaignWhereForPermission(sessionUser.user.id, 'document.edit') },
    },
    include: { session: true },
  })
  if (!recording) {
    return fail(404, 'NOT_FOUND', 'Recording not found')
  }

  const transcript = await prisma.document.findFirst({
    where: {
      sessionId: recording.sessionId,
      type: 'TRANSCRIPT',
      campaign: buildCampaignWhereForPermission(sessionUser.user.id, 'content.read'),
    },
    include: { currentVersion: true },
  })
  if (!transcript?.currentVersion?.content) {
    return fail(404, 'NOT_FOUND', 'Session transcript not found')
  }

  const rawContent = transcript.currentVersion.content
  const vttContent = isSegmentedTranscript(rawContent)
    ? segmentsToVtt(parseTranscriptSegments(rawContent))
    : isLikelySrt(rawContent)
      ? srtToVtt(rawContent)
      : normalizeVtt(rawContent)

  const service = new RecordingService()
  await service.attachVttFromStream({
    ownerId: sessionUser.user.id,
    campaignId: recording.session.campaignId,
    recordingId,
    filename: 'subtitles.vtt',
    mimeType: 'text/vtt',
    stream: Readable.from(vttContent),
  })

  const updated = await prisma.recording.findUnique({ where: { id: recordingId } })
  return ok(updated)
})
