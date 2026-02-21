import { z } from 'zod'
import type { CampaignPermission } from '#server/utils/campaign-auth'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'
import { prisma } from '#server/db/prisma'
import type { ServiceResult } from '#server/services/auth.service'
import {
  calendarConfigUpsertSchema,
  calendarMonthSchema,
  calendarMoonSchema,
  calendarTemplateApplySchema,
  calendarWeekdaySchema,
  createCalendarDateBoundsSchema,
  type CalendarConfigUpsertInput,
  type CalendarCurrentDateUpdateInput,
  type CalendarTemplateApplyInput,
} from '#shared/schemas/calendar'
import type {
  CalendarMonth,
  CalendarMoon,
  CalendarTemplateId,
  CalendarWeekday,
  CampaignCalendarConfig,
} from '#shared/types/calendar'
import { NameGeneratorService } from '#server/services/calendar/name-generator.service'

type CampaignCalendarConfigRow = {
  id: string
  campaignId: string
  isEnabled: boolean
  name: string
  startingYear: number
  firstWeekdayIndex: number
  currentYear: number
  currentMonth: number
  currentDay: number
  weekdaysJson: unknown
  monthsJson: unknown
  moonsJson: unknown
  createdAt: Date
  updatedAt: Date
}

export type CampaignCalendarConfigDto = CampaignCalendarConfig & {
  yearLength: number
}

const weekdayArraySchema = z.array(calendarWeekdaySchema)
const monthArraySchema = z.array(calendarMonthSchema)
const moonArraySchema = z.array(calendarMoonSchema)
const nameGeneratorService = new NameGeneratorService()

const hashSeed = (seed: string) => {
  let hash = 2166136261 >>> 0
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const createSeededRandom = (seed: string) => {
  let state = hashSeed(seed) || 0x9e3779b9
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 0xffffffff
  }
}

const deriveYearLength = (months: CalendarMonth[]) => months.reduce((sum, month) => sum + month.length, 0)

const randomInt = (random: () => number, minInclusive: number, maxInclusive: number) =>
  Math.floor(random() * (maxInclusive - minInclusive + 1)) + minInclusive

const toConfigDto = (row: CampaignCalendarConfigRow): CampaignCalendarConfigDto => {
  const weekdays = weekdayArraySchema.parse(row.weekdaysJson)
  const months = monthArraySchema.parse(row.monthsJson)
  const moons = moonArraySchema.parse(row.moonsJson)

  return {
    id: row.id,
    campaignId: row.campaignId,
    isEnabled: row.isEnabled,
    name: row.name,
    startingYear: row.startingYear,
    firstWeekdayIndex: row.firstWeekdayIndex,
    currentYear: row.currentYear,
    currentMonth: row.currentMonth,
    currentDay: row.currentDay,
    weekdays,
    months,
    moons,
    yearLength: deriveYearLength(months),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

const buildRandomTemplate = (seed?: string): CalendarConfigUpsertInput => {
  const random = createSeededRandom(seed || 'calendar-random-template')

  const weekdayCount = randomInt(random, 5, 10)
  const monthCount = randomInt(random, 8, 14)
  const moonCount = randomInt(random, 0, 3)

  const weekdays: CalendarWeekday[] = nameGeneratorService
    .generateNames('weekday', weekdayCount, `${seed || 'random'}:weekday`)
    .map((name) => ({ name }))

  const months: CalendarMonth[] = nameGeneratorService
    .generateNames('month', monthCount, `${seed || 'random'}:month`)
    .map((name, index) => ({
      name,
      length: randomInt(random, 24, index % 3 === 0 ? 40 : 36),
    }))

  const moons: CalendarMoon[] = nameGeneratorService
    .generateNames('moon', moonCount, `${seed || 'random'}:moon`)
    .map((name) => {
      const cycleLength = randomInt(random, 10, 45)
      return {
        name,
        cycleLength,
        phaseOffset: randomInt(random, 0, cycleLength - 1),
      }
    })

  return {
    isEnabled: true,
    name: 'Random Fantasy Calendar',
    startingYear: randomInt(random, 1, 4000),
    firstWeekdayIndex: randomInt(random, 0, weekdays.length - 1),
    currentYear: randomInt(random, 1, 4000),
    currentMonth: randomInt(random, 1, months.length),
    currentDay: 1,
    weekdays,
    months,
    moons,
  }
}

const buildTemplate = (templateId: CalendarTemplateId, seed?: string): CalendarConfigUpsertInput => {
  if (templateId === 'earth') {
    return {
      isEnabled: true,
      name: 'Earth Calendar',
      startingYear: 2026,
      firstWeekdayIndex: 2,
      currentYear: 2026,
      currentMonth: 1,
      currentDay: 1,
      weekdays: [
        { name: 'Monday' },
        { name: 'Tuesday' },
        { name: 'Wednesday' },
        { name: 'Thursday' },
        { name: 'Friday' },
        { name: 'Saturday' },
        { name: 'Sunday' },
      ],
      months: [
        { name: 'January', length: 31 },
        { name: 'February', length: 28 },
        { name: 'March', length: 31 },
        { name: 'April', length: 30 },
        { name: 'May', length: 31 },
        { name: 'June', length: 30 },
        { name: 'July', length: 31 },
        { name: 'August', length: 31 },
        { name: 'September', length: 30 },
        { name: 'October', length: 31 },
        { name: 'November', length: 30 },
        { name: 'December', length: 31 },
      ],
      moons: [{ name: 'Moon', cycleLength: 29, phaseOffset: 0 }],
    }
  }

  if (templateId === 'tonalpohualli') {
    return {
      isEnabled: true,
      name: 'Tonalpohualli-Inspired',
      startingYear: 1,
      firstWeekdayIndex: 0,
      currentYear: 1,
      currentMonth: 1,
      currentDay: 1,
      weekdays: [
        { name: 'Cipactli' }, { name: 'Ehecatl' }, { name: 'Calli' }, { name: 'Cuetzpalin' },
        { name: 'Coatl' }, { name: 'Miquiztli' }, { name: 'Mazatl' }, { name: 'Tochtli' },
        { name: 'Atl' }, { name: 'Itzcuintli' }, { name: 'Ozomahtli' }, { name: 'Malinalli' },
        { name: 'Acatl' }, { name: 'Ocelotl' }, { name: 'Cuauhtli' }, { name: 'Cozcacuauhtli' },
        { name: 'Ollin' }, { name: 'Tecpatl' }, { name: 'Quiahuitl' }, { name: 'Xochitl' },
      ],
      months: new Array(13).fill(null).map((_, index) => ({
        name: `Trecena ${index + 1}`,
        length: 20,
      })),
      moons: [],
    }
  }

  if (templateId === 'fantasy_a') {
    return {
      isEnabled: true,
      name: 'Fantasy Example A',
      startingYear: 1000,
      firstWeekdayIndex: 0,
      currentYear: 1000,
      currentMonth: 1,
      currentDay: 1,
      weekdays: [
        { name: 'Dawnsday' },
        { name: 'Embersday' },
        { name: 'Rainsday' },
        { name: 'Windsday' },
        { name: 'Stonesday' },
        { name: 'Starsday' },
        { name: 'Shadesday' },
        { name: 'Kingsday' },
      ],
      months: [
        { name: 'Ashenrise', length: 36 },
        { name: 'Mistcall', length: 36 },
        { name: 'Sunstride', length: 36 },
        { name: 'Brighttide', length: 36 },
        { name: 'Highflame', length: 36 },
        { name: 'Harvestwane', length: 36 },
        { name: 'Leafmourn', length: 36 },
        { name: 'Longdusk', length: 36 },
        { name: 'Nightveil', length: 36 },
        { name: 'Frostwake', length: 36 },
      ],
      moons: [
        { name: 'Aure', cycleLength: 18, phaseOffset: 0 },
        { name: 'Nox', cycleLength: 27, phaseOffset: 3 },
      ],
    }
  }

  if (templateId === 'fantasy_b') {
    return {
      isEnabled: true,
      name: 'Fantasy Example B',
      startingYear: 432,
      firstWeekdayIndex: 2,
      currentYear: 432,
      currentMonth: 1,
      currentDay: 1,
      weekdays: [
        { name: 'Reday' },
        { name: 'Orday' },
        { name: 'Yeday' },
        { name: 'Graday' },
        { name: 'Bluday' },
      ],
      months: [
        { name: 'Torrent', length: 61 },
        { name: 'Gale', length: 61 },
        { name: 'Verdance', length: 61 },
        { name: 'Emberfall', length: 61 },
        { name: 'Shiver', length: 61 },
        { name: 'Stillnight', length: 60 },
      ],
      moons: [{ name: 'Pearl', cycleLength: 30, phaseOffset: 15 }],
    }
  }

  return buildRandomTemplate(seed)
}

export class CalendarConfigService {
  private async ensureCampaignPermission(campaignId: string, userId: string, permission: CampaignPermission) {
    return prisma.campaign.findFirst({
      where: { id: campaignId, ...buildCampaignWhereForPermission(userId, permission) },
      select: { id: true },
    })
  }

  private async getConfigRow(campaignId: string) {
    return prisma.campaignCalendarConfig.findUnique({
      where: { campaignId },
      select: {
        id: true,
        campaignId: true,
        isEnabled: true,
        name: true,
        startingYear: true,
        firstWeekdayIndex: true,
        currentYear: true,
        currentMonth: true,
        currentDay: true,
        weekdaysJson: true,
        monthsJson: true,
        moonsJson: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  }

  async getConfig(campaignId: string, userId: string): Promise<ServiceResult<CampaignCalendarConfigDto | null>> {
    const campaign = await this.ensureCampaignPermission(campaignId, userId, 'campaign.read')
    if (!campaign) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Campaign not found or access denied.',
      }
    }

    const config = await this.getConfigRow(campaignId)
    if (!config) {
      return { ok: true, data: null }
    }

    return { ok: true, data: toConfigDto(config) }
  }

  async upsertConfig(
    campaignId: string,
    userId: string,
    input: CalendarConfigUpsertInput,
  ): Promise<ServiceResult<CampaignCalendarConfigDto>> {
    const campaign = await this.ensureCampaignPermission(campaignId, userId, 'campaign.update')
    if (!campaign) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Campaign not found or access denied.',
      }
    }

    const parsedInput = calendarConfigUpsertSchema.parse(input)

    const updated = await prisma.campaignCalendarConfig.upsert({
      where: { campaignId },
      create: {
        campaignId,
        isEnabled: parsedInput.isEnabled,
        name: parsedInput.name,
        startingYear: parsedInput.startingYear,
        firstWeekdayIndex: parsedInput.firstWeekdayIndex,
        currentYear: parsedInput.currentYear,
        currentMonth: parsedInput.currentMonth,
        currentDay: parsedInput.currentDay,
        weekdaysJson: parsedInput.weekdays,
        monthsJson: parsedInput.months,
        moonsJson: parsedInput.moons,
      },
      update: {
        isEnabled: parsedInput.isEnabled,
        name: parsedInput.name,
        startingYear: parsedInput.startingYear,
        firstWeekdayIndex: parsedInput.firstWeekdayIndex,
        currentYear: parsedInput.currentYear,
        currentMonth: parsedInput.currentMonth,
        currentDay: parsedInput.currentDay,
        weekdaysJson: parsedInput.weekdays,
        monthsJson: parsedInput.months,
        moonsJson: parsedInput.moons,
      },
      select: {
        id: true,
        campaignId: true,
        isEnabled: true,
        name: true,
        startingYear: true,
        firstWeekdayIndex: true,
        currentYear: true,
        currentMonth: true,
        currentDay: true,
        weekdaysJson: true,
        monthsJson: true,
        moonsJson: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return { ok: true, data: toConfigDto(updated) }
  }

  async applyTemplate(
    campaignId: string,
    userId: string,
    input: CalendarTemplateApplyInput & { seed?: string },
  ): Promise<ServiceResult<CampaignCalendarConfigDto>> {
    const parsedInput = calendarTemplateApplySchema.parse(input)
    const seed = input.seed ? z.string().min(1).max(120).parse(input.seed) : undefined
    const templateInput = buildTemplate(parsedInput.templateId, seed)
    return this.upsertConfig(campaignId, userId, templateInput)
  }

  async updateCurrentDate(
    campaignId: string,
    userId: string,
    input: CalendarCurrentDateUpdateInput,
  ): Promise<ServiceResult<CampaignCalendarConfigDto>> {
    const campaign = await this.ensureCampaignPermission(campaignId, userId, 'campaign.update')
    if (!campaign) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Campaign not found or access denied.',
      }
    }

    const existing = await this.getConfigRow(campaignId)
    if (!existing) {
      return {
        ok: false,
        statusCode: 404,
        code: 'CALENDAR_CONFIG_NOT_FOUND',
        message: 'Calendar config not found for campaign.',
      }
    }

    if (!existing.isEnabled) {
      return {
        ok: false,
        statusCode: 409,
        code: 'CALENDAR_DISABLED',
        message: 'Calendar is currently disabled for this campaign.',
      }
    }

    const months = monthArraySchema.parse(existing.monthsJson)
    createCalendarDateBoundsSchema(months).parse(input)

    const updated = await prisma.campaignCalendarConfig.update({
      where: { campaignId },
      data: {
        currentYear: input.year,
        currentMonth: input.month,
        currentDay: input.day,
      },
      select: {
        id: true,
        campaignId: true,
        isEnabled: true,
        name: true,
        startingYear: true,
        firstWeekdayIndex: true,
        currentYear: true,
        currentMonth: true,
        currentDay: true,
        weekdaysJson: true,
        monthsJson: true,
        moonsJson: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return { ok: true, data: toConfigDto(updated) }
  }
}

export { deriveYearLength }
