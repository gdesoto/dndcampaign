export type TranscriptSegment = {
  id: string
  startMs: number | null
  endMs: number | null
  speaker?: string | null
  text: string
  confidence?: number | null
  source?: string | null
  disabled?: boolean | null
}

type SegmentedTranscriptPayload = {
  version: number
  segments: TranscriptSegment[]
}

const timecodePattern = /(\d{2}):(\d{2}):(\d{2})[.,](\d{3})/

const parseTimecode = (value: string) => {
  const match = value.match(timecodePattern)
  if (!match) return null
  const [, hours, minutes, seconds, millis] = match
  const totalMs =
    Number(hours) * 60 * 60 * 1000 +
    Number(minutes) * 60 * 1000 +
    Number(seconds) * 1000 +
    Number(millis)
  return Number.isFinite(totalMs) ? totalMs : null
}

const extractSpeakerLabel = (value: string) => {
  const speakerMatch = value.match(/\[(.+?)\]\s*$/)
  if (!speakerMatch) return { speaker: null, rest: value }
  const speaker = speakerMatch[1]?.trim()
  const rest = value.replace(speakerMatch[0], '').trim()
  return { speaker: speaker || null, rest }
}

const extractSpeakerFromText = (value: string) => {
  const match = value.match(/^([A-Za-z][\w\s.'-]{0,30}):\s+(.*)$/)
  if (!match) return { speaker: null, text: value }
  const speaker = match[1]?.trim() || null
  const text = match[2]?.trim() || value
  return { speaker, text }
}

const normalizeText = (value: string) =>
  value
    .replace(/\s+/g, ' ')
    .split('\u0000').join('')
    .trim()

const parseTimedTranscript = (content: string) => {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const segments: TranscriptSegment[] = []
  let index = 0

  while (index < lines.length) {
    const rawLine = lines[index]?.trim() ?? ''
    if (!rawLine || rawLine === 'WEBVTT') {
      index += 1
      continue
    }
    if (/^\d+$/.test(rawLine)) {
      index += 1
      continue
    }
    if (!rawLine.includes('-->')) {
      index += 1
      continue
    }

    const [startPart = '', rest = ''] = rawLine.split('-->')
    if (!rest) {
      index += 1
      continue
    }
    const startMs = parseTimecode(startPart.trim())
    const endLine = rest.trim()
    const { speaker, rest: endRest } = extractSpeakerLabel(endLine)
    const endMs = parseTimecode(endRest)

    index += 1
    const textLines: string[] = []
    while (index < lines.length) {
      const line = lines[index] ?? ''
      if (!line.trim()) {
        if (textLines.length) {
          index += 1
          break
        }
        index += 1
        continue
      }
      if (line.includes('-->') && timecodePattern.test(line)) {
        break
      }
      textLines.push(line.trim())
      index += 1
    }

    const combined = normalizeText(textLines.join(' '))
    if (!combined) continue
    const speakerFromText = extractSpeakerFromText(combined)
    const finalSpeaker = speaker || speakerFromText.speaker

    segments.push({
      id: `seg_${segments.length + 1}`,
      startMs: startMs ?? null,
      endMs: endMs ?? null,
      speaker: finalSpeaker,
      text: speaker ? combined : speakerFromText.text,
    })
  }

  return segments
}

const parsePlainTranscript = (content: string) => {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  if (!normalized) return []
  const chunks = normalized.split(/\n{2,}/)
  return chunks
    .map((chunk, idx) => {
      const text = normalizeText(chunk)
      if (!text) return null
      const speakerExtracted = extractSpeakerFromText(text)
      return {
        id: `seg_${idx + 1}`,
        startMs: null,
        endMs: null,
        speaker: speakerExtracted.speaker,
        text: speakerExtracted.text,
      }
    })
    .filter(Boolean) as TranscriptSegment[]
}

export const isSegmentedTranscript = (content: string) => {
  if (!content) return false
  const trimmed = content.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false
  try {
    const parsed = JSON.parse(trimmed) as SegmentedTranscriptPayload | TranscriptSegment[]
    if (Array.isArray(parsed)) {
      return parsed.every((segment) => typeof segment?.text === 'string')
    }
    return Array.isArray(parsed.segments)
  } catch {
    return false
  }
}

type RawWord = {
  start?: number
  end?: number
  speaker_id?: string | null
}

type RawSegment = {
  id?: string
  startMs?: number
  endMs?: number
  start?: number
  end?: number
  speaker?: string | null
  text?: string
  confidence?: number | null
  source?: string | null
  disabled?: boolean | null
  words?: RawWord[]
}

type SegmentLike = RawSegment | TranscriptSegment

const hasLegacyTimeFields = (segment: SegmentLike): segment is SegmentLike & { start?: number; end?: number } =>
  'start' in segment || 'end' in segment

const hasWords = (segment: SegmentLike): segment is RawSegment =>
  Array.isArray((segment as RawSegment).words)

const hasText = (segment: SegmentLike | null | undefined): segment is SegmentLike & { text: string } =>
  !!segment && typeof segment.text === 'string'

const extractSpeakerFromWords = (segment: { words?: RawWord[] }) =>
  segment.words?.find((word) => word?.speaker_id)?.speaker_id ?? null

const extractTimesFromWords = (segment: { words?: RawWord[] }) => {
  if (!segment.words?.length) return { startMs: null, endMs: null }
  const firstWord = segment.words[0]
  const lastWord = segment.words[segment.words.length - 1]
  const startMs =
    typeof firstWord?.start === 'number' && Number.isFinite(firstWord.start)
      ? firstWord.start * 1000
      : null
  const endMs =
    typeof lastWord?.end === 'number' && Number.isFinite(lastWord.end)
      ? lastWord.end * 1000
      : null
  return { startMs, endMs }
}

export const parseTranscriptSegments = (content: string): TranscriptSegment[] => {
  if (!content) return []
  const trimmed = content.trim()
  if (isSegmentedTranscript(trimmed)) {
    const parsed = JSON.parse(trimmed) as SegmentedTranscriptPayload | RawSegment[]
    const segments: SegmentLike[] = Array.isArray(parsed) ? parsed : parsed.segments
    return segments
      .filter(hasText)
      .map((segment, idx) => {
        const fallbackStart =
          hasLegacyTimeFields(segment) &&
          typeof segment.start === 'number' &&
          Number.isFinite(segment.start)
            ? segment.start * 1000
            : null
        let startMs =
          typeof segment.startMs === 'number' && Number.isFinite(segment.startMs)
            ? segment.startMs
            : fallbackStart
        const fallbackEnd =
          hasLegacyTimeFields(segment) &&
          typeof segment.end === 'number' &&
          Number.isFinite(segment.end)
            ? segment.end * 1000
            : null
        let endMs =
          typeof segment.endMs === 'number' && Number.isFinite(segment.endMs)
            ? segment.endMs
            : fallbackEnd
        if (startMs === null || endMs === null) {
          const derived = hasWords(segment)
            ? extractTimesFromWords(segment)
            : { startMs: null, endMs: null }
          if (startMs === null) startMs = derived.startMs
          if (endMs === null) endMs = derived.endMs
        }
        const speaker =
          segment.speaker ??
          (hasWords(segment) ? extractSpeakerFromWords(segment) : null) ??
          null

        return {
          id: segment.id || `seg_${idx + 1}`,
          startMs,
          endMs,
          speaker,
          text: normalizeText(segment.text),
          confidence:
            typeof segment.confidence === 'number' && Number.isFinite(segment.confidence)
              ? segment.confidence
              : null,
          source: segment.source ?? null,
          disabled: typeof segment.disabled === 'boolean' ? segment.disabled : null,
        }
      })
  }

  const hasTimecodes = /\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->/.test(trimmed)
  if (hasTimecodes) {
    const segments = parseTimedTranscript(trimmed)
    if (segments.length) return segments
  }

  return parsePlainTranscript(trimmed)
}

export const serializeTranscriptSegments = (segments: TranscriptSegment[]) => {
  const payload: SegmentedTranscriptPayload = {
    version: 1,
    segments: segments.map((segment) => ({
      id: segment.id,
      startMs: segment.startMs ?? null,
      endMs: segment.endMs ?? null,
      speaker: segment.speaker ?? null,
      text: segment.text,
      confidence: segment.confidence ?? null,
      source: segment.source ?? null,
      disabled: typeof segment.disabled === 'boolean' ? segment.disabled : null,
    })),
  }
  return JSON.stringify(payload)
}

export const segmentsToPlainText = (
  segments: TranscriptSegment[],
  options?: { includeDisabled?: boolean }
) => {
  const includeDisabled = options?.includeDisabled !== false
  return segments
    .filter((segment) => includeDisabled || !segment.disabled)
    .map((segment) => {
      const speaker = segment.speaker ? `${segment.speaker}: ` : ''
      return `${speaker}${segment.text}`.trim()
    })
    .join('\n\n')
}

const formatMs = (value: number) => {
  const clamped = Math.max(0, value)
  const hours = Math.floor(clamped / 3600000)
  const minutes = Math.floor((clamped % 3600000) / 60000)
  const seconds = Math.floor((clamped % 60000) / 1000)
  const milliseconds = Math.floor(clamped % 1000)
  const base = `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  return `${base}.${milliseconds.toString().padStart(3, '0')}`
}

export const segmentsToVtt = (segments: TranscriptSegment[]) => {
  const lines: string[] = ['WEBVTT', '']
  for (const segment of segments) {
    if (segment.disabled) continue
    if (typeof segment.startMs !== 'number' || typeof segment.endMs !== 'number') {
      continue
    }
    lines.push(`${formatMs(segment.startMs)} --> ${formatMs(segment.endMs)}`)
    const speaker = segment.speaker ? `[${segment.speaker}] ` : ''
    lines.push(`${speaker}${segment.text}`.trim())
    lines.push('')
  }
  return lines.join('\n').trimEnd() + '\n'
}
