import { readdir, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { useRuntimeConfig } from '#imports'
import { prisma } from '#server/db/prisma'
import type { ServiceResult } from '#server/services/auth.service'
import { ArtifactService } from '#server/services/artifact.service'
import { getStorageAdapter } from '#server/services/storage/storage.factory'
import type { AdminStorageAuditFixInput, AdminStorageAuditQuery } from '#shared/schemas/admin'

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
  recordings: number
  vttRecordings: number
  recapRecordings: number
  transcriptionArtifacts: number
  characterPortraits: number
}) =>
  counts.recordings
  + counts.vttRecordings
  + counts.recapRecordings
  + counts.transcriptionArtifacts
  + counts.characterPortraits

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

    const artifactWhere = {
      provider: 'LOCAL' as const,
      ...(query.campaignId ? { campaignId: query.campaignId } : {}),
    }

    const [artifactRowsRaw, documentRowsRaw] = await Promise.all([
      prisma.artifact.findMany({
        where: artifactWhere,
        select: {
          id: true,
          campaignId: true,
          storageKey: true,
          byteSize: true,
          mimeType: true,
          createdAt: true,
          _count: {
            select: {
              recordings: true,
              vttRecordings: true,
              recapRecordings: true,
              transcriptionArtifacts: true,
              characterPortraits: true,
            },
          },
        },
      }),
      prisma.document.findMany({
        where: query.campaignId ? { campaignId: query.campaignId } : undefined,
        select: {
          id: true,
          campaignId: true,
          title: true,
          type: true,
          currentVersionId: true,
          currentVersion: { select: { id: true } },
          _count: { select: { versions: true } },
        },
      }),
    ])

    const latestDocumentVersionById = new Map<string, string>()
    if (documentRowsRaw.length) {
      const latestVersionRows = await prisma.documentVersion.findMany({
        where: { documentId: { in: documentRowsRaw.map((row) => row.id) } },
        orderBy: [{ documentId: 'asc' }, { versionNumber: 'desc' }],
        select: { documentId: true, id: true },
      })

      for (const row of latestVersionRows) {
        if (!latestDocumentVersionById.has(row.documentId)) {
          latestDocumentVersionById.set(row.documentId, row.id)
        }
      }
    }

    const scannedFileMap = new Map(scanned.rows.map((row) => [row.storageKey, row]))
    const artifactByStorageKey = new Map(artifactRowsRaw.map((row) => [row.storageKey, row]))

    const artifactRows = artifactRowsRaw.map((row) => {
      const referencedCount = sumArtifactReferenceCount(row._count)
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
      const versionCount = row._count.versions
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
      const campaigns = await prisma.campaign.findMany({
        where: { id: { in: Array.from(campaignIds) } },
        select: { id: true, name: true },
      })
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

  async applyFix(input: AdminStorageAuditFixInput): Promise<ServiceResult<{
    action: AdminStorageAuditFixInput['action']
    targetId: string
    message: string
  }>> {
    if (input.action === 'DELETE_ORPHAN_STORAGE_FILE') {
      const linkedArtifact = await prisma.artifact.findFirst({
        where: {
          provider: 'LOCAL',
          storageKey: input.storageKey,
        },
        select: { id: true },
      })

      if (linkedArtifact) {
        return {
          ok: false,
          statusCode: 409,
          code: 'ARTIFACT_EXISTS',
          message: 'Storage key is still linked to an artifact record.',
        }
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
        ok: true,
        data: {
          action: input.action,
          targetId: input.storageKey,
          message: 'Orphaned storage file deleted.',
        },
      }
    }

    if (input.action === 'DELETE_UNREFERENCED_ARTIFACT') {
      const artifact = await prisma.artifact.findUnique({
        where: { id: input.artifactId },
        select: {
          id: true,
          _count: {
            select: {
              recordings: true,
              vttRecordings: true,
              recapRecordings: true,
              transcriptionArtifacts: true,
              characterPortraits: true,
            },
          },
        },
      })

      if (!artifact) {
        return {
          ok: false,
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'Artifact not found.',
        }
      }

      const referencedCount = sumArtifactReferenceCount(artifact._count)
      if (referencedCount > 0) {
        return {
          ok: false,
          statusCode: 409,
          code: 'ARTIFACT_REFERENCED',
          message: 'Artifact is still referenced and cannot be removed.',
        }
      }

      await this.artifactService.deleteArtifact(artifact.id)
      return {
        ok: true,
        data: {
          action: input.action,
          targetId: artifact.id,
          message: 'Unreferenced artifact deleted.',
        },
      }
    }

    if (input.action === 'REPAIR_DOCUMENT_CURRENT_VERSION') {
      const document = await prisma.document.findUnique({
        where: { id: input.documentId },
        select: {
          id: true,
          currentVersionId: true,
          versions: {
            select: { id: true },
            orderBy: { versionNumber: 'desc' },
            take: 1,
          },
        },
      })

      if (!document) {
        return {
          ok: false,
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'Document not found.',
        }
      }

      const latestVersion = document.versions[0]
      if (!latestVersion) {
        return {
          ok: false,
          statusCode: 409,
          code: 'DOCUMENT_EMPTY',
          message: 'Document has no versions to set as current.',
        }
      }

      if (document.currentVersionId === latestVersion.id) {
        return {
          ok: true,
          data: {
            action: input.action,
            targetId: document.id,
            message: 'Document current version is already valid.',
          },
        }
      }

      await prisma.document.update({
        where: { id: document.id },
        data: { currentVersionId: latestVersion.id },
      })

      return {
        ok: true,
        data: {
          action: input.action,
          targetId: document.id,
          message: 'Document current version repaired.',
        },
      }
    }

    const document = await prisma.document.findUnique({
      where: { id: input.documentId },
      select: {
        id: true,
        _count: { select: { versions: true } },
      },
    })

    if (!document) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Document not found.',
      }
    }

    if (document._count.versions > 0) {
      return {
        ok: false,
        statusCode: 409,
        code: 'DOCUMENT_NOT_EMPTY',
        message: 'Document has versions and cannot be deleted as empty.',
      }
    }

    await prisma.document.delete({ where: { id: document.id } })
    return {
      ok: true,
      data: {
        action: input.action,
        targetId: document.id,
        message: 'Empty document deleted.',
      },
    }
  }
}
