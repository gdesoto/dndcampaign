export const adminSections = [
  { label: 'Overview', title: 'System administration', to: '/admin', icon: 'i-lucide-layout-dashboard', group: 'Administration', description: 'A view of the people, campaigns, and activity across DM Vault.' },
  { label: 'Users', title: 'User management', to: '/admin/users', icon: 'i-lucide-users', group: 'Management', description: 'Find accounts and manage their access and system roles.' },
  { label: 'Campaigns', title: 'Campaign management', to: '/admin/campaigns', icon: 'i-lucide-flag', group: 'Management', description: 'Review campaigns, manage archival status, and transfer ownership.' },
  { label: 'Analytics', title: 'Analytics and reporting', to: '/admin/analytics', icon: 'i-lucide-chart-column', group: 'Reporting', description: 'Explore campaign usage, job outcomes, and downloadable reports.' },
  { label: 'Activity log', title: 'Activity log', to: '/admin/activity', icon: 'i-lucide-scroll-text', group: 'Reporting', description: 'Trace actions across campaigns, administration, and the system.' },
  { label: 'Storage audit', title: 'Storage audit', to: '/admin/storage-audit', icon: 'i-lucide-database-backup', group: 'Maintenance', description: 'Inspect stored files and document integrity, then resolve issues.' },
  { label: 'Dev Tools', title: 'Dev Tools', to: '/admin/dev-tools', icon: 'i-lucide-wrench', group: 'Maintenance', description: 'Inspect runtime configuration, test workflows, and migrate characters.', devOnly: true },
] as const

export const getAdminSections = (isDev: boolean) => adminSections.filter(section => !('devOnly' in section) || isDev)
