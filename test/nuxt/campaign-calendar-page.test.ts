import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import CampaignCalendarPage from '../../app/pages/campaigns/[campaignId]/calendar.vue'

const mockRequest = vi.fn()
const mockGetCalendarView = vi.fn()
const mockGetRanges = vi.fn()
const mockCreateEvent = vi.fn()
const mockUpdateEvent = vi.fn()
const mockDeleteEvent = vi.fn()
const mockUpdateCurrentDate = vi.fn()
const mockUpsertSessionRange = vi.fn()
const mockDeleteSessionRange = vi.fn()

mockNuxtImport('useRoute', () => () => ({
  params: { campaignId: 'campaign-1' },
}))

mockNuxtImport('useApi', () => () => ({
  request: mockRequest,
}))

vi.mock('~/composables/useCampaignCalendar', () => ({
  useCampaignCalendar: () => ({
    getCalendarView: mockGetCalendarView,
    getRanges: mockGetRanges,
    createEvent: mockCreateEvent,
    updateEvent: mockUpdateEvent,
    deleteEvent: mockDeleteEvent,
    updateCurrentDate: mockUpdateCurrentDate,
    upsertSessionRange: mockUpsertSessionRange,
    deleteSessionRange: mockDeleteSessionRange,
  }),
}))

const enabledView = {
  config: {
    id: 'cfg-1',
    campaignId: 'campaign-1',
    isEnabled: true,
    name: 'Calendar',
    startingYear: 1,
    firstWeekdayIndex: 0,
    currentYear: 100,
    currentMonth: 1,
    currentDay: 3,
    weekdays: [{ name: 'Moonday' }],
    months: [{ name: 'Firstmoon', length: 30 }],
    moons: [],
    yearLength: 30,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  currentDate: { year: 100, month: 1, day: 3 },
  selectedMonth: { year: 100, month: 1, index: 0, name: 'Firstmoon', length: 30 },
  events: [{ id: 'evt-1', campaignId: 'campaign-1', year: 100, month: 1, day: 1, title: 'Festival', description: null, createdByUserId: 'u1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
  sessionRanges: [],
}

describe('Campaign calendar page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequest.mockResolvedValue([])
    mockGetRanges.mockResolvedValue([])
    mockCreateEvent.mockResolvedValue({
      id: 'evt-new',
      campaignId: 'campaign-1',
      year: 100,
      month: 1,
      day: 3,
      title: 'New Event',
      description: null,
      createdByUserId: 'u1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  })

  it('shows empty state when calendar is disabled', async () => {
    mockGetCalendarView.mockResolvedValue({
      config: {
        ...enabledView.config,
        isEnabled: false,
      },
      currentDate: { year: 100, month: 1, day: 1 },
      selectedMonth: null,
      events: [],
      sessionRanges: [],
    })

    const wrapper = await mountSuspended(CampaignCalendarPage, {
      global: {
        provide: {
          campaignAccess: ref({
            role: 'OWNER',
            permissions: ['campaign.update'],
          }),
        },
      },
    })

    expect(wrapper.text()).toContain('Fantasy calendar is disabled')
    expect(wrapper.text()).toContain('Open Settings > General')
  })

  it('shows read-only state for viewers on enabled calendar', async () => {
    mockGetCalendarView.mockResolvedValue(enabledView)

    const wrapper = await mountSuspended(CampaignCalendarPage, {
      global: {
        provide: {
          campaignAccess: ref({
            role: 'VIEWER',
            permissions: ['campaign.read'],
          }),
        },
      },
    })

    expect(wrapper.text()).toContain('Read-only access')
    expect(wrapper.text()).toContain('Campaign calendar')
    const addEventButton = wrapper.findAll('button').find((button) => button.text().includes('Add event'))
    expect(addEventButton).toBeUndefined()
  })

})
