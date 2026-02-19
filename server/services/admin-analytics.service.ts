import { prisma } from '#server/db/prisma'
import type {
  AdminAnalyticsJobsQuery,
  AdminAnalyticsOverviewQuery,
  AdminAnalyticsUsageQuery,
} from '#shared/schemas/admin'

const toUtcDateKey = (date: Date) => date.toISOString().slice(0, 10)

const parseDateRange = (from?: string, to?: string) => {
  const now = new Date()
  const rangeEnd = to ? new Date(`${to}T23:59:59.999Z`) : now
  const rangeStart = from
    ? new Date(`${from}T00:00:00.000Z`)
    : new Date(rangeEnd.getTime() - 29 * 24 * 60 * 60 * 1000)

  return {
    start: rangeStart,
    end: rangeEnd,
  }
}

const formatCsvCell = (value: string | number | boolean | null) => {
  if (value === null) return ''
  const asString = String(value)
  if (asString.includes(',') || asString.includes('"') || asString.includes('\n')) {
    return `"${asString.replace(/"/g, '""')}"`
  }

  return asString
}

export class AdminAnalyticsService {
  async getOverview(query: AdminAnalyticsOverviewQuery) {
    const asOf = query.at ? new Date(`${query.at}T23:59:59.999Z`) : new Date()
    const dayAgo = new Date(asOf.getTime() - 24 * 60 * 60 * 1000)
    const weekAgo = new Date(asOf.getTime() - 7 * 24 * 60 * 60 * 1000)

    const [totalUsers, totalCampaigns, dauUsers, wauUsers, campaigns, storageByProvider, storageByCampaign] =
      await Promise.all([
        prisma.user.count(),
        prisma.campaign.count(),
        prisma.user.count({
          where: { lastLoginAt: { gte: dayAgo, lte: asOf } },
        }),
        prisma.user.count({
          where: { lastLoginAt: { gte: weekAgo, lte: asOf } },
        }),
        prisma.campaign.findMany({
          select: {
            id: true,
            _count: { select: { members: true } },
          },
        }),
        prisma.artifact.groupBy({
          by: ['provider'],
          _sum: { byteSize: true },
          _count: { _all: true },
        }),
        prisma.artifact.groupBy({
          by: ['campaignId'],
          _sum: { byteSize: true },
          _count: { _all: true },
          where: { campaignId: { not: null } },
        }),
      ])

    const campaignIds = storageByCampaign.map((entry) => entry.campaignId).filter(Boolean) as string[]
    const campaignNames = campaignIds.length
      ? await prisma.campaign.findMany({
          where: { id: { in: campaignIds } },
          select: { id: true, name: true },
        })
      : []

    const campaignNameMap = new Map(campaignNames.map((campaign) => [campaign.id, campaign.name]))

    const buckets = {
      '1': 0,
      '2-5': 0,
      '6-10': 0,
      '11+': 0,
    }

    for (const campaign of campaigns) {
      const count = Math.max(1, campaign._count.members)
      if (count === 1) buckets['1'] += 1
      else if (count <= 5) buckets['2-5'] += 1
      else if (count <= 10) buckets['6-10'] += 1
      else buckets['11+'] += 1
    }

    return {
      asOf: asOf.toISOString(),
      totals: {
        users: totalUsers,
        campaigns: totalCampaigns,
        dau: dauUsers,
        wau: wauUsers,
      },
      campaignsByMemberBuckets: [
        { bucket: '1', count: buckets['1'] },
        { bucket: '2-5', count: buckets['2-5'] },
        { bucket: '6-10', count: buckets['6-10'] },
        { bucket: '11+', count: buckets['11+'] },
      ],
      storageByProvider: storageByProvider.map((entry) => ({
        provider: entry.provider,
        totalBytes: entry._sum.byteSize || 0,
        artifactCount: entry._count._all,
      })),
      storageByCampaign: storageByCampaign.map((entry) => ({
        campaignId: entry.campaignId,
        campaignName: entry.campaignId ? campaignNameMap.get(entry.campaignId) || 'Unknown campaign' : 'Unknown campaign',
        totalBytes: entry._sum.byteSize || 0,
        artifactCount: entry._count._all,
      })),
    }
  }

  async getUsage(query: AdminAnalyticsUsageQuery) {
    const { start, end } = parseDateRange(query.from, query.to)

    const [users, campaigns, artifacts] = await Promise.all([
      prisma.user.findMany({
        where: {
          lastLoginAt: {
            gte: start,
            lte: end,
          },
        },
        select: {
          id: true,
          lastLoginAt: true,
        },
      }),
      prisma.campaign.findMany({
        orderBy: { updatedAt: 'desc' },
        take: query.campaignLimit,
        select: {
          id: true,
          name: true,
          isArchived: true,
          updatedAt: true,
          owner: {
            select: {
              email: true,
              name: true,
            },
          },
          _count: {
            select: {
              members: true,
              sessions: true,
            },
          },
        },
      }),
      prisma.artifact.groupBy({
        by: ['campaignId'],
        where: {
          campaignId: { not: null },
        },
        _sum: { byteSize: true },
        _count: { _all: true },
      }),
    ])

    const daySet = new Map<string, Set<string>>()
    for (const user of users) {
      if (!user.lastLoginAt) continue
      const key = toUtcDateKey(user.lastLoginAt)
      if (!daySet.has(key)) daySet.set(key, new Set())
      daySet.get(key)?.add(user.id)
    }

    const dailyActiveUsers = Array.from(daySet.entries())
      .map(([date, values]) => ({ date, activeUsers: values.size }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const artifactByCampaign = new Map(
      artifacts.map((entry) => [
        entry.campaignId as string,
        {
          totalBytes: entry._sum.byteSize || 0,
          artifactCount: entry._count._all,
        },
      ])
    )

    const campaignUsage = campaigns.map((campaign) => {
      const artifactUsage = artifactByCampaign.get(campaign.id)
      return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        ownerEmail: campaign.owner.email,
        ownerName: campaign.owner.name,
        isArchived: campaign.isArchived,
        memberCount: Math.max(1, campaign._count.members),
        sessionCount: campaign._count.sessions,
        artifactCount: artifactUsage?.artifactCount || 0,
        storageBytes: artifactUsage?.totalBytes || 0,
        updatedAt: campaign.updatedAt.toISOString(),
      }
    })

    return {
      dateRange: {
        from: start.toISOString(),
        to: end.toISOString(),
      },
      dailyActiveUsers,
      campaignUsage,
    }
  }

  async getJobs(query: AdminAnalyticsJobsQuery) {
    const { start, end } = parseDateRange(query.from, query.to)

    const [transcriptionJobs, summaryJobs] = await Promise.all([
      prisma.transcriptionJob.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: {
          id: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.summaryJob.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: {
          id: true,
          status: true,
          createdAt: true,
        },
      }),
    ])

    const transcriptionCompleted = transcriptionJobs.filter((job) => job.status === 'COMPLETED').length
    const transcriptionFailed = transcriptionJobs.filter((job) => job.status === 'FAILED').length

    const summaryCompleted = summaryJobs.filter((job) => ['READY_FOR_REVIEW', 'APPLIED'].includes(job.status)).length
    const summaryFailed = summaryJobs.filter((job) => job.status === 'FAILED').length

    const dayMap = new Map<
      string,
      {
        transcriptionCompleted: number
        transcriptionFailed: number
        summaryCompleted: number
        summaryFailed: number
      }
    >()

    for (const job of transcriptionJobs) {
      const day = toUtcDateKey(job.createdAt)
      if (!dayMap.has(day)) {
        dayMap.set(day, {
          transcriptionCompleted: 0,
          transcriptionFailed: 0,
          summaryCompleted: 0,
          summaryFailed: 0,
        })
      }

      if (job.status === 'COMPLETED') dayMap.get(day)!.transcriptionCompleted += 1
      if (job.status === 'FAILED') dayMap.get(day)!.transcriptionFailed += 1
    }

    for (const job of summaryJobs) {
      const day = toUtcDateKey(job.createdAt)
      if (!dayMap.has(day)) {
        dayMap.set(day, {
          transcriptionCompleted: 0,
          transcriptionFailed: 0,
          summaryCompleted: 0,
          summaryFailed: 0,
        })
      }

      if (['READY_FOR_REVIEW', 'APPLIED'].includes(job.status)) dayMap.get(day)!.summaryCompleted += 1
      if (job.status === 'FAILED') dayMap.get(day)!.summaryFailed += 1
    }

    const daily = Array.from(dayMap.entries())
      .map(([date, value]) => ({ date, ...value }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return {
      dateRange: {
        from: start.toISOString(),
        to: end.toISOString(),
      },
      transcription: {
        total: transcriptionJobs.length,
        completed: transcriptionCompleted,
        failed: transcriptionFailed,
        successRate:
          transcriptionJobs.length === 0 ? 0 : Number((transcriptionCompleted / transcriptionJobs.length).toFixed(4)),
      },
      summary: {
        total: summaryJobs.length,
        completed: summaryCompleted,
        failed: summaryFailed,
        successRate: summaryJobs.length === 0 ? 0 : Number((summaryCompleted / summaryJobs.length).toFixed(4)),
      },
      daily,
    }
  }

  buildUsageCsv(data: Awaited<ReturnType<AdminAnalyticsService['getUsage']>>) {
    const header = [
      'campaign_id',
      'campaign_name',
      'owner_email',
      'owner_name',
      'is_archived',
      'member_count',
      'session_count',
      'artifact_count',
      'storage_bytes',
      'updated_at',
    ]

    const rows = data.campaignUsage.map((row) => [
      row.campaignId,
      row.campaignName,
      row.ownerEmail,
      row.ownerName,
      row.isArchived,
      row.memberCount,
      row.sessionCount,
      row.artifactCount,
      row.storageBytes,
      row.updatedAt,
    ])

    return [header, ...rows]
      .map((line) => line.map((value) => formatCsvCell(value)).join(','))
      .join('\n')
  }

  buildJobsCsv(data: Awaited<ReturnType<AdminAnalyticsService['getJobs']>>) {
    const header = [
      'date',
      'transcription_completed',
      'transcription_failed',
      'summary_completed',
      'summary_failed',
    ]

    const rows = data.daily.map((row) => [
      row.date,
      row.transcriptionCompleted,
      row.transcriptionFailed,
      row.summaryCompleted,
      row.summaryFailed,
    ])

    return [header, ...rows]
      .map((line) => line.map((value) => formatCsvCell(value)).join(','))
      .join('\n')
  }
}
