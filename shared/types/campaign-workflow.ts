export type CampaignShell = {
  id: string
  name: string
  system?: string | null
  dungeonMasterName?: string | null
}

export type CampaignAccess = {
  campaignId: string
  role: 'OWNER' | 'COLLABORATOR' | 'VIEWER'
  permissions: Array<
    | 'campaign.read'
    | 'campaign.update'
    | 'campaign.delete'
    | 'campaign.members.manage'
    | 'campaign.settings.manage'
    | 'campaign.public.manage'
    | 'content.read'
    | 'content.write'
    | 'recording.upload'
    | 'recording.transcribe'
    | 'document.edit'
    | 'summary.run'
  >
}

export type SessionShellHeader = {
  id: string
  title: string
  sessionNumber?: number | null
  playedAt?: string | null
}

export type CampaignWorkspace = {
  campaign: CampaignShell
  sessionHeader: SessionShellHeader | null
  access: CampaignAccess
}
