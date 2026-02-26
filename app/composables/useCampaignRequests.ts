import type {
  CampaignRequestCreateInput,
  CampaignRequestDecisionInput,
  CampaignRequestListQueryInput,
  CampaignRequestUpdateInput,
} from '#shared/schemas/campaign-requests'
import type {
  CampaignRequestDetail,
  CampaignRequestListResponse,
} from '#shared/types/campaign-requests'

export function useCampaignRequests() {
  const { request } = useApi()

  const listRequests = async (campaignId: string, query: Partial<CampaignRequestListQueryInput> = {}) =>
    request<CampaignRequestListResponse>(`/api/campaigns/${campaignId}/requests`, {
      query,
    })

  const getRequest = async (campaignId: string, requestId: string) =>
    request<CampaignRequestDetail>(`/api/campaigns/${campaignId}/requests/${requestId}`)

  const createRequest = async (campaignId: string, input: CampaignRequestCreateInput) =>
    request<CampaignRequestDetail>(`/api/campaigns/${campaignId}/requests`, {
      method: 'POST',
      body: input,
    })

  const updateRequest = async (campaignId: string, requestId: string, input: CampaignRequestUpdateInput) =>
    request<CampaignRequestDetail>(`/api/campaigns/${campaignId}/requests/${requestId}`, {
      method: 'PATCH',
      body: input,
    })

  const cancelRequest = async (campaignId: string, requestId: string) =>
    request<CampaignRequestDetail>(`/api/campaigns/${campaignId}/requests/${requestId}/cancel`, {
      method: 'POST',
    })

  const addVote = async (campaignId: string, requestId: string) =>
    request<CampaignRequestDetail>(`/api/campaigns/${campaignId}/requests/${requestId}/votes`, {
      method: 'POST',
    })

  const removeMyVote = async (campaignId: string, requestId: string) =>
    request<CampaignRequestDetail>(`/api/campaigns/${campaignId}/requests/${requestId}/votes/mine`, {
      method: 'DELETE',
    })

  const decideRequest = async (
    campaignId: string,
    requestId: string,
    input: CampaignRequestDecisionInput,
  ) =>
    request<CampaignRequestDetail>(`/api/campaigns/${campaignId}/requests/${requestId}/decision`, {
      method: 'POST',
      body: input,
    })

  return {
    listRequests,
    getRequest,
    createRequest,
    updateRequest,
    cancelRequest,
    addVote,
    removeMyVote,
    decideRequest,
  }
}
