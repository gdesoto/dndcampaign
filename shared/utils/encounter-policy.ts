import type { EncounterStatus } from '../types/encounter'

export const lifecycleTargets = {
  start: 'ACTIVE',
  pause: 'PAUSED',
  resume: 'ACTIVE',
  complete: 'COMPLETED',
  abandon: 'ABANDONED',
  reopen: 'PAUSED',
  reset: 'PLANNED',
} as const
export type EncounterLifecycleAction = keyof typeof lifecycleTargets
export const encounterActions = [
  'start',
  'pause',
  'resume',
  'complete',
  'abandon',
  'reopen',
  'reset',
  'edit',
  'participants',
  'initiative',
  'turn',
  'effects',
  'conditions',
  'notes',
] as const
export type EncounterAction = (typeof encounterActions)[number]
export type EncounterActionAvailability = Record<
  EncounterAction,
  { allowed: boolean; reason?: string }
>
const phases: Record<EncounterAction, readonly EncounterStatus[]> = {
  start: ['PLANNED'],
  pause: ['ACTIVE'],
  resume: ['PAUSED'],
  complete: ['ACTIVE', 'PAUSED'],
  abandon: ['PLANNED', 'ACTIVE', 'PAUSED'],
  reopen: ['COMPLETED', 'ABANDONED'],
  reset: ['ACTIVE', 'PAUSED'],
  edit: ['PLANNED', 'ACTIVE', 'PAUSED'],
  participants: ['PLANNED', 'ACTIVE', 'PAUSED'],
  initiative: ['PLANNED', 'ACTIVE', 'PAUSED'],
  turn: ['ACTIVE'],
  effects: ['ACTIVE', 'PAUSED'],
  conditions: ['PLANNED', 'ACTIVE', 'PAUSED'],
  notes: ['PLANNED', 'ACTIVE', 'PAUSED'],
}
export function getEncounterActions(
  status: EncounterStatus,
  participantCount: number,
  canWrite = true,
): EncounterActionAvailability {
  return Object.fromEntries(
    encounterActions.map((action) => {
      let reason: string | undefined
      if (!canWrite) reason = 'Your role cannot modify this encounter.'
      else if (!phases[action].includes(status)) {
        const next =
          status === 'COMPLETED' || status === 'ABANDONED'
            ? 'Reopen the encounter first.'
            : status === 'PAUSED'
              ? 'Resume the encounter first.'
              : status === 'PLANNED'
                ? 'Start the encounter first.'
                : 'Choose an action available in the current phase.'
        reason = `${action} is unavailable while the encounter is ${status.toLowerCase()}. ${next}`
      } else if (
        ['start', 'resume', 'turn', 'initiative', 'effects'].includes(action) &&
        participantCount === 0
      ) {
        reason = 'Add at least one participant first.'
      }
      return [action, reason ? { allowed: false, reason } : { allowed: true }]
    }),
  ) as EncounterActionAvailability
}
