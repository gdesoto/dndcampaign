import { and, asc, desc, eq } from 'drizzle-orm'
import { db } from '#server/db/client'
import { document, recapRecording, recording, session } from '#server/db/schema'
import { resolveCampaignAccess } from '#server/utils/campaign-auth'

export class SessionWorkspaceService {
  async getWorkspace(sessionId: string, userId: string, systemRole?: 'USER' | 'SYSTEM_ADMIN') {
    const sessionRow = db.query.session.findFirst({ where: eq(session.id, sessionId), with: { campaign: { columns: { dungeonMasterName: true } } } }).sync()
    if (!sessionRow) return null
    const accessResolution = await resolveCampaignAccess(sessionRow.campaignId, userId, systemRole)
    if (!accessResolution.access) return null
    const recordings = db.select().from(recording).where(eq(recording.sessionId, sessionId)).orderBy(desc(recording.createdAt)).all()
    const recaps = db.select().from(recapRecording).where(eq(recapRecording.sessionId, sessionId)).orderBy(asc(recapRecording.kind)).all()
    const transcriptDoc = db.query.document.findFirst({ where: and(eq(document.sessionId, sessionId), eq(document.type, 'TRANSCRIPT')), with: { currentVersion: true } }).sync() ?? null
    const summaryDoc = db.query.document.findFirst({ where: and(eq(document.sessionId, sessionId), eq(document.type, 'SUMMARY')), with: { currentVersion: true } }).sync() ?? null
    return { session: sessionRow, recordings, recaps, recap: recaps[0] ?? null, transcriptDoc, summaryDoc, access: accessResolution.access }
  }
}
