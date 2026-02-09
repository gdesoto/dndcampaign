type UseCampaignWorkspaceInvalidationOptions = {
  refreshCampaign: () => Promise<void>
}

export function useCampaignWorkspaceInvalidation(options: UseCampaignWorkspaceInvalidationOptions) {
  const refreshWorkspace = async () => options.refreshCampaign()
  const afterCampaignMutation = async () => options.refreshCampaign()
  const afterRecapMutation = async () => options.refreshCampaign()

  return {
    refreshWorkspace,
    afterCampaignMutation,
    afterRecapMutation,
  }
}
