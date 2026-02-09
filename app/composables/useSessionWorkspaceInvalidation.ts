type UseSessionWorkspaceInvalidationOptions = {
  refreshSession: () => Promise<void>
  refreshRecordings: () => Promise<void>
  refreshRecap: () => Promise<void>
  refreshTranscript: () => Promise<void>
  refreshSummary: () => Promise<void>
  refreshAll: () => Promise<void>
}

export function useSessionWorkspaceInvalidation(options: UseSessionWorkspaceInvalidationOptions) {
  const refreshWorkspace = async () => options.refreshAll()
  const afterSessionMutation = async () => options.refreshSession()
  const afterRecordingsMutation = async () => options.refreshRecordings()
  const afterRecapMutation = async () => options.refreshRecap()
  const afterTranscriptMutation = async () => options.refreshTranscript()
  const afterSummaryMutation = async () => options.refreshSummary()

  return {
    refreshWorkspace,
    afterSessionMutation,
    afterRecordingsMutation,
    afterRecapMutation,
    afterTranscriptMutation,
    afterSummaryMutation,
  }
}
