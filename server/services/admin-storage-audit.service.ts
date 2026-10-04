import { readdir, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { useRuntimeConfig } from '#imports'
import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { eq, and, inArray, asc, desc, sql } from 'drizzle-orm'
import { ArtifactService } from '#server/services/artifact.service'
import { getStorageAdapter } from '#server/services/storage/storage.factory'
import type { AdminStorageAuditFixInput, AdminStorageAuditQuery } from '#shared/schemas/admin'
import { apiError } from '#server/utils/http'

type ScannedStorageFile = {
  storageKey: string
  byteSize: number
}

type ArtifactRowStatus =
  | 'OK'
  | 'MISSING_FILE'
  | 'UNREFERENCED'
  | 'MISSING_FILE_AND_UNREFERENCED'

type DocumentRowStatus = 'OK' | 'MISSING_CURRENT_VERSION' | 'EMPTY'

const toStorageKey = (value: string) => value.replace(/\\/g, '/')

const campaignIdInStorageKey = (storageKey: string) => {
  const match = storageKey.match(/^campaigns\/([0-9a-fA-F-]{36})\//)
  return match?.[1] || null
}

const sumArtifactReferenceCount = (counts: {
  recordingsCount: number
  vttRecordingsCount: number
  recapRecordingsCount: number
  transcriptionArtifactsCount: number
  characterPortraitsCount: number
}) =>
  counts.recordingsCount
  + counts.vttRecordingsCount
  + counts.recapRecordingsCount
  + counts.transcriptionArtifactsCount
  + counts.characterPortraitsCount

const scanLocalStorageFiles = async (root: string) => {
  const rows: ScannedStorageFile[] = []
  let rootExists = true

  const walk = async (currentPath: string, keyPrefix: string) => {
    const entries = await readdir(currentPath, { withFileTypes: true })
    for (const entry of entries) {
      const nextPath = join(currentPath, entry.name)
      const nextPrefix = keyPrefix ? `${keyPrefix}/${entry.name}` : entry.name

      if (entry.isDirectory()) {
        await walk(nextPath, nextPrefix)
        continue
      }

      if (!entry.isFile()) {
        continue
      }

      const fileStats = await stat(nextPath)
      rows.push({
        storageKey: toStorageKey(nextPrefix),
        byteSize: fileStats.size,
      })
    }
  }

  try {
    await walk(root, '')
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') {
      throw error
    }
    rootExists = false
  }

  return { rows, rootExists }
}

const toArtifactStatus = (existsOnStorage: boolean, referencedCount: number): ArtifactRowStatus => {
  if (!existsOnStorage && referencedCount === 0) return 'MISSING_FILE_AND_UNREFERENCED'
  if (!existsOnStorage) return 'MISSING_FILE'
  if (referencedCount === 0) return 'UNREFERENCED'
  return 'OK'
}

const toDocumentStatus = (versionCount: number, hasCurrentVersion: boolean): DocumentRowStatus => {
  if (versionCount === 0) return 'EMPTY'
  if (!hasCurrentVersion) return 'MISSING_CURRENT_VERSION'
  return 'OK'
}

export class AdminStorageAuditService {
  private artifactService = new ArtifactService()

  async runAudit(query: AdminStorageAuditQuery) {
    const runtimeConfig = useRuntimeConfig()
    const provider = String(runtimeConfig.storage?.provider || 'local').toLowerCase()
    const localRoot = String(runtimeConfig.storage?.localRoot || './storage')
    const localRootAbsolute = resolve(localRoot)

    const warnings: string[] = []

    if (provider !== 'local') {
      warnings.push(`Storage provider "${provider}" is not fully supported by this audit.`)
    }

    const scanned = await scanLocalStorageFiles(localRootAbsolute)
    if (!scanned.rootExists) {
      warnings.push(`Storage root not found at ${localRootAbsolute}.`)
    }

    const artifactWhere = and(eq(tables.artifact.provider, 'LOCAL'), query.campaignId ? eq(tables.artifact.campaignId, query.campaignId) : undefined)

    const [artifactRowsRaw, documentRowsRaw] = await Promise.all([
      db.query.artifact.findMany({
        where: artifactWhere,
        extras: { recordingsCount: sql<number>`(select count(*) from "Recording" where "Recording"."artifactId" = ${sql.raw('"artifact"."id"')})`.mapWith(Number).as('recordings_count'),
          vttRecordingsCount: sql<number>`(select count(*) from "Recording" where "Recording"."vttArtifactId" = ${sql.raw('"artifact"."id"')})`.mapWith(Number).as('vttRecordings_count'),
          recapRecordingsCount: sql<number>`(select count(*) from "RecapRecording" where "RecapRecording"."artifactId" = ${sql.raw('"artifact"."id"')})`.mapWith(Number).as('recapRecordings_count'),
          transcriptionArtifactsCount: sql<number>`(select count(*) from "TranscriptionArtifact" where "TranscriptionArtifact"."artifactId" = ${sql.raw('"artifact"."id"')})`.mapWith(Number).as('transcriptionArtifacts_count'),
          characterPortraitsCount: sql<number>`(select count(*) from "PlayerCharacter" where "PlayerCharacter"."portraitArtifactId" = ${sql.raw('"artifact"."id"')})`.mapWith(Number).as('characterPortraits_count') },
        columns: {
          id: true,
          campaignId: true,
          storageKey: true,
          byteSize: true,
          mimeType: true,
          createdAt: true
        }
      }).sync(),
      db.query.document.findMany({
        where: query.campaignId ? eq(tables.document.campaignId, query.campaignId) : undefined,
        extras: { versionsCount: sql<number>`(select count(*) from "DocumentVersion" where "DocumentVersion"."documentId" = ${sql.raw('"document"."id"')})`.mapWith(Number).as('versions_count') },
        columns: {
          id: true,
          campaignId: true,
          title: true,
          type: true,
          currentVersionId: true
        },
        with: { currentVersion: { columns: { id: true } } }
      }).sync(),
    ])

    const latestDocumentVersionById = new Map<string, string>()
    if (documentRowsRaw.length) {
      const latestVersionRows = await db.query.documentVersion.findMany({
        where: inArray(tables.documentVersion.documentId, documentRowsRaw.map((row) => row.id)),
        orderBy: [asc(tables.documentVersion.documentId), desc(tables.documentVersion.versionNumber)],
        columns: {
          documentId: true,
          id: true
        }
      }).sync()

      for (const row of latestVersionRows) {
        if (!latestDocumentVersionById.has(row.documentId)) {
          latestDocumentVersionById.set(row.documentId, row.id)
        }
      }
    }

    const scannedFileMap = new Map(scanned.rows.map((row) => [row.storageKey, row]))
    const artifactByStorageKey = new Map(artifactRowsRaw.map((row) => [row.storageKey, row]))

    const artifactRows = artifactRowsRaw.map((row) => {
      const referencedCount = sumArtifactReferenceCount(row)
      const existsOnStorage = scannedFileMap.has(row.storageKey)
      const status = toArtifactStatus(existsOnStorage, referencedCount)

      const fixActions = referencedCount === 0
        ? (['DELETE_UNREFERENCED_ARTIFACT'] as const)
        : ([] as const)

      return {
        artifactId: row.id,
        campaignId: row.campaignId,
        storageKey: row.storageKey,
        mimeType: row.mimeType,
        byteSize: row.byteSize,
        createdAt: row.createdAt.toISOString(),
        referencedCount,
        existsOnStorage,
        status,
        fixActions,
      }
    })

    const orphanStorageRows = scanned.rows
      .filter((row) => {
        if (artifactByStorageKey.has(row.storageKey)) return false
        if (!query.campaignId) return true
        return campaignIdInStorageKey(row.storageKey) === query.campaignId
      })
      .map((row) => ({
        storageKey: row.storageKey,
        byteSize: row.byteSize,
        campaignId: campaignIdInStorageKey(row.storageKey),
        fixActions: ['DELETE_ORPHAN_STORAGE_FILE'] as const,
      }))

    const documentRows = documentRowsRaw.map((row) => {
      const versionCount = row.versionsCount
      const hasCurrentVersion = Boolean(row.currentVersionId && row.currentVersion?.id)
      const status = toDocumentStatus(versionCount, hasCurrentVersion)
      const latestVersionId = latestDocumentVersionById.get(row.id) || null

      const fixActions =
        status === 'MISSING_CURRENT_VERSION' && latestVersionId
          ? (['REPAIR_DOCUMENT_CURRENT_VERSION'] as const)
          : status === 'EMPTY'
            ? (['DELETE_EMPTY_DOCUMENT'] as const)
            : ([] as const)

      return {
        documentId: row.id,
        campaignId: row.campaignId,
        title: row.title,
        type: row.type,
        currentVersionId: row.currentVersionId,
        latestVersionId,
        versionCount,
        status,
        fixActions,
      }
    })

    const campaignIds = new Set<string>()
    for (const row of artifactRows) {
      if (row.campaignId) campaignIds.add(row.campaignId)
    }
    for (const row of documentRows) {
      campaignIds.add(row.campaignId)
    }
    for (const row of orphanStorageRows) {
      if (row.campaignId) campaignIds.add(row.campaignId)
    }

    const campaignNameById = new Map<string, string>()
    if (campaignIds.size > 0) {
      const campaigns = await db.query.campaign.findMany({
        where: inArray(tables.campaign.id, Array.from(campaignIds)),
        columns: {
          id: true,
          name: true
        }
      }).sync()
      for (const campaign of campaigns) {
        campaignNameById.set(campaign.id, campaign.name)
      }
    }

    const artifactRowsWithCampaign = artifactRows.map((row) => ({
      ...row,
      campaignName: row.campaignId ? campaignNameById.get(row.campaignId) || null : null,
    }))

    const documentRowsWithCampaign = documentRows.map((row) => ({
      ...row,
      campaignName: campaignNameById.get(row.campaignId) || null,
    }))

    const orphanRowsWithCampaign = orphanStorageRows.map((row) => ({
      ...row,
      campaignName: row.campaignId ? campaignNameById.get(row.campaignId) || null : null,
    }))

    const artifactIssueRows = artifactRowsWithCampaign.filter((row) => row.status !== 'OK')
    const documentIssueRows = documentRowsWithCampaign.filter((row) => row.status !== 'OK')

    return {
      generatedAt: new Date().toISOString(),
      provider,
      localRoot: localRootAbsolute,
      warnings,
      filters: {
        campaignId: query.campaignId || null,
        issuesOnly: query.issuesOnly,
      },
      summary: {
        artifacts: {
          total: artifactRowsWithCampaign.length,
          ok: artifactRowsWithCampaign.filter((row) => row.status === 'OK').length,
          missingFile: artifactRowsWithCampaign.filter((row) => row.status.includes('MISSING_FILE')).length,
          unreferenced: artifactRowsWithCampaign.filter((row) => row.status.includes('UNREFERENCED')).length,
        },
        storage: {
          scannedFiles: scanned.rows.length,
          orphanFiles: orphanRowsWithCampaign.length,
          rootExists: scanned.rootExists,
        },
        documents: {
          total: documentRowsWithCampaign.length,
          ok: documentRowsWithCampaign.filter((row) => row.status === 'OK').length,
          missingCurrentVersion: documentRowsWithCampaign.filter((row) => row.status === 'MISSING_CURRENT_VERSION').length,
          empty: documentRowsWithCampaign.filter((row) => row.status === 'EMPTY').length,
        },
        totalIssues: artifactIssueRows.length + documentIssueRows.length + orphanRowsWithCampaign.length,
        fixableIssues:
          artifactIssueRows.filter((row) => row.fixActions.length > 0).length
          + documentIssueRows.filter((row) => row.fixActions.length > 0).length
          + orphanRowsWithCampaign.length,
      },
      artifactRows: query.issuesOnly ? artifactIssueRows : artifactRowsWithCampaign,
      orphanStorageRows: orphanRowsWithCampaign,
      documentRows: query.issuesOnly ? documentIssueRows : documentRowsWithCampaign,
    }
  }

  async applyFix(input: AdminStorageAuditFixInput): Promise<{
    action: AdminStorageAuditFixInput['action']
    targetId: string
    message: string
  }> {
    if (input.action === 'DELETE_ORPHAN_STORAGE_FILE') {
      const linkedArtifact = await db.query.artifact.findFirst({
        where: and(eq(tables.artifact.provider, 'LOCAL'), eq(tables.artifact.storageKey, input.storageKey)),
        columns: { id: true }
      }).sync()

      if (linkedArtifact) {
        throw apiError(409, 'ARTIFACT_EXISTS', 'Storage key is still linked to an artifact record.')
      }

      const adapter = getStorageAdapter()
      try {
        await adapter.deleteObject(input.storageKey)
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code
        if (code !== 'ENOENT') {
          throw error
        }
      }

      return {
          action: input.action,
          targetId: input.storageKey,
          message: 'Orphaned storage file deleted.',
        }
    }

    if (input.action === 'DELETE_UNREFERENCED_ARTIFACT') {
      const artifact = await db.query.artifact.findFirst({
        where: eq(tables.artifact.id, input.artifactId),
        extras: { recordingsCount: sql<number>`(select count(*) from "Recording" where "Recording"."artifactId" = ${sql.raw('"artifact"."id"')})`.mapWith(Number).as('recordings_count'),
          vttRecordingsCount: sql<number>`(select count(*) from "Recording" where "Recording"."vttArtifactId" = ${sql.raw('"artifact"."id"')})`.mapWith(Number).as('vttRecordings_count'),
          recapRecordingsCount: sql<number>`(select count(*) from "RecapRecording" where "RecapRecording"."artifactId" = ${sql.raw('"artifact"."id"')})`.mapWith(Number).as('recapRecordings_count'),
          transcriptionArtifactsCount: sql<number>`(select count(*) from "TranscriptionArtifact" where "TranscriptionArtifact"."artifactId" = ${sql.raw('"artifact"."id"')})`.mapWith(Number).as('transcriptionArtifacts_count'),
          characterPortraitsCount: sql<number>`(select count(*) from "PlayerCharacter" where "PlayerCharacter"."portraitArtifactId" = ${sql.raw('"artifact"."id"')})`.mapWith(Number).as('characterPortraits_count') },
        columns: { id: true }
      }).sync()

      if (!artifact) {
        throw apiError(404, 'NOT_FOUND', 'Artifact not found.')
      }

      const referencedCount = sumArtifactReferenceCount(artifact)
      if (referencedCount > 0) {
        throw apiError(409, 'ARTIFACT_REFERENCED', 'Artifact is still referenced and cannot be removed.')
      }

      await this.artifactService.deleteArtifact(artifact.id)
      return {
          action: input.action,
          targetId: artifact.id,
          message: 'Unreferenced artifact deleted.',
        }
    }

    if (input.action === 'REPAIR_DOCUMENT_CURRENT_VERSION') {
      const document = await db.query.document.findFirst({
        where: eq(tables.document.id, input.documentId),
        columns: {
          id: true,
          currentVersionId: true
        },
        with: { versions: {
            orderBy: [desc(tables.documentVersion.versionNumber)],
            limit: 1,
            columns: { id: true }
          } }
      }).sync()

      if (!document) {
        throw apiError(404, 'NOT_FOUND', 'Document not found.')
      }

      const latestVersion = document.versions[0]
      if (!latestVersion) {
        throw apiError(409, 'DOCUMENT_EMPTY', 'Document has no versions to set as current.')
      }

      if (document.currentVersionId === latestVersion.id) {
        return {
            action: input.action,
            targetId: document.id,
            message: 'Document current version is already valid.',
          }
      }

      await db.update(tables.document).set({ currentVersionId: latestVersion.id }).where(eq(tables.document.id, document.id)).returning().get()!

      return {
          action: input.action,
          targetId: document.id,
          message: 'Document current version repaired.',
        }
    }

    const document = await db.query.document.findFirst({
      where: eq(tables.document.id, input.documentId),
      extras: { versionsCount: sql<number>`(select count(*) from "DocumentVersion" where "DocumentVersion"."documentId" = ${sql.raw('"document"."id"')})`.mapWith(Number).as('versions_count') },
      columns: { id: true }
    }).sync()

    if (!document) {
      throw apiError(404, 'NOT_FOUND', 'Document not found.')
    }

    if (document.versionsCount > 0) {
      throw apiError(409, 'DOCUMENT_NOT_EMPTY', 'Document has versions and cannot be deleted as empty.')
    }

    await db.delete(tables.document).where(eq(tables.document.id, document.id)).returning().get()!
    return {
        action: input.action,
        targetId: document.id,
        message: 'Empty document deleted.',
      }
  }
}
