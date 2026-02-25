import { prisma } from '#server/db/prisma'
import type { DocumentFormat, DocumentSource, DocumentType } from '#server/db/prisma-client'

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

export class DocumentService {
  async createDocument(input: CreateDocumentInput) {
    return prisma.$transaction(async (tx) => {
      const document = await tx.document.create({
        data: {
          campaignId: input.campaignId,
          sessionId: input.sessionId || null,
          recordingId: input.recordingId || null,
          type: input.type,
          title: input.title,
        },
      })

      const version = await tx.documentVersion.create({
        data: {
          documentId: document.id,
          versionNumber: 1,
          content: input.content,
          format: input.format,
          source: input.source,
          createdByUserId: input.createdByUserId || null,
        },
      })

      const updated = await tx.document.update({
        where: { id: document.id },
        data: { currentVersionId: version.id },
        include: { currentVersion: true },
      })

      return updated
    })
  }

  async updateDocument(input: UpdateDocumentInput) {
    return prisma.$transaction(async (tx) => {
      const latest = await tx.documentVersion.findFirst({
        where: { documentId: input.documentId },
        orderBy: { versionNumber: 'desc' },
        select: { versionNumber: true },
      })
      const versionNumber = latest ? latest.versionNumber + 1 : 1

      const version = await tx.documentVersion.create({
        data: {
          documentId: input.documentId,
          versionNumber,
          content: input.content,
          format: input.format,
          source: input.source,
          createdByUserId: input.createdByUserId || null,
        },
      })

      return tx.document.update({
        where: { id: input.documentId },
        data: { currentVersionId: version.id },
        include: { currentVersion: true },
      })
    })
  }

  async listVersions(documentId: string, options?: { includeContent?: boolean }) {
    const includeContent = options?.includeContent === true

    if (includeContent) {
      return prisma.documentVersion.findMany({
        where: { documentId },
        orderBy: { versionNumber: 'desc' },
        select: {
          id: true,
          versionNumber: true,
          content: true,
          format: true,
          source: true,
          createdByUserId: true,
          createdAt: true,
        },
      })
    }

    return prisma.documentVersion.findMany({
      where: { documentId },
      orderBy: { versionNumber: 'desc' },
      select: {
        id: true,
        versionNumber: true,
        format: true,
        source: true,
        createdByUserId: true,
        createdAt: true,
      },
    })
  }

  async restoreVersion(documentId: string, versionId: string) {
    return prisma.document.update({
      where: { id: documentId },
      data: { currentVersionId: versionId },
      include: { currentVersion: true },
    })
  }
}

