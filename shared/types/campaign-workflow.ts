export type CampaignShell = {
  id: string
  name: string
  system?: string | null
  dungeonMasterName?: string | null
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
}
