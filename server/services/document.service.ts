import { and, desc, eq } from 'drizzle-orm'
import { db } from '#server/db/client'
import { document, documentVersion } from '#server/db/schema'
import type { DocumentFormat, DocumentSource, DocumentType } from '#server/db/schema'

type CreateDocumentInput = {
  campaignId: string
  sessionId?: string | null
  recordingId?: string | null
  type: DocumentType
  title: string
  content: string
  format: DocumentFormat
  source: DocumentSource
  createdByUserId?: string | null
}

type UpdateDocumentInput = {
  documentId: string
  content: string
  format: DocumentFormat
  source: DocumentSource
  createdByUserId?: string | null
}

type UpsertForSessionInput = Omit<CreateDocumentInput, 'sessionId' | 'type'>

export class DocumentService {
  async createDocument(input: CreateDocumentInput) {
    return db.transaction((tx) => {
      const created = tx.insert(document).values({
        campaignId: input.campaignId,
        sessionId: input.sessionId || null,
        recordingId: input.recordingId || null,
        type: input.type,
        title: input.title,
      }).returning().get()!
      const version = tx.insert(documentVersion).values({
        documentId: created.id,
        versionNumber: 1,
        content: input.content,
        format: input.format,
        source: input.source,
        createdByUserId: input.createdByUserId || null,
      }).returning().get()!
      const updated = tx.update(document).set({ currentVersionId: version.id }).where(eq(document.id, created.id)).returning().get()!
      return { ...updated, currentVersion: version }
    }, { behavior: 'immediate' })
  }

  async updateDocument(input: UpdateDocumentInput) {
    return db.transaction((tx) => {
      const latest = tx.select({ versionNumber: documentVersion.versionNumber }).from(documentVersion)
        .where(eq(documentVersion.documentId, input.documentId)).orderBy(desc(documentVersion.versionNumber)).get()
      const version = tx.insert(documentVersion).values({
        documentId: input.documentId,
        versionNumber: latest ? latest.versionNumber + 1 : 1,
        content: input.content,
        format: input.format,
        source: input.source,
        createdByUserId: input.createdByUserId || null,
      }).returning().get()!
      const updated = tx.update(document).set({ currentVersionId: version.id }).where(eq(document.id, input.documentId)).returning().get()!
      return { ...updated, currentVersion: version }
    }, { behavior: 'immediate' })
  }

  async upsertForSession(sessionId: string, type: DocumentType, input: UpsertForSessionInput) {
    const existing = db.select().from(document).where(and(eq(document.sessionId, sessionId), eq(document.type, type))).get()
    if (existing) return this.updateDocument({ documentId: existing.id, content: input.content, format: input.format, source: input.source, createdByUserId: input.createdByUserId })
    return this.createDocument({ ...input, sessionId, type })
  }

  async listVersions(documentId: string, options?: { includeContent?: boolean }) {
    return db.query.documentVersion.findMany({
      where: eq(documentVersion.documentId, documentId),
      orderBy: desc(documentVersion.versionNumber),
      columns: { id: true, versionNumber: true, ...(options?.includeContent ? { content: true } : {}), format: true, source: true, createdByUserId: true, createdAt: true },
    }).sync()
  }

  async restoreVersion(documentId: string, versionId: string) {
    return db.transaction((tx) => {
      const updated = tx.update(document).set({ currentVersionId: versionId }).where(eq(document.id, documentId)).returning().get()!
      const version = tx.select().from(documentVersion).where(eq(documentVersion.id, versionId)).get() ?? null
      return { ...updated, currentVersion: version }
    }, { behavior: 'immediate' })
  }
}
