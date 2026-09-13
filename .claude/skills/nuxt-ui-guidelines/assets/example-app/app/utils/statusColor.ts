// Domain mappings stay outside the portable presentation toolkit.
const statusColors = {
  Active: 'success', Published: 'success', Planned: 'info',
  Archived: 'neutral', Draft: 'neutral',
  'Instructor required': 'warning', 'Room required': 'warning',
  'Over capacity': 'error',
} as const;
export function statusColor(status: string) {
  return statusColors[status as keyof typeof statusColors] ?? 'neutral';
}
