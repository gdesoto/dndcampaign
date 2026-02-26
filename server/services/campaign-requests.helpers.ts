import type { CampaignRequestStatus, CampaignRequestVisibility } from '#shared/types/campaign-requests'
import { hasCampaignDmAccess } from '#server/utils/campaign-auth'
import type { ResolvedCampaignAccess } from '#server/utils/campaign-auth'

type CampaignRequestVisibilityAccessInput = {
  createdByUserId: string
  visibility: CampaignRequestVisibility
}

type CampaignRequestAccessInput = CampaignRequestVisibilityAccessInput & {
  status: CampaignRequestStatus
}

export const isPendingRequest = (status: CampaignRequestStatus) => status === 'PENDING'

export const isModeratableByAccess = (access: ResolvedCampaignAccess, status: CampaignRequestStatus) =>
  hasCampaignDmAccess(access) && isPendingRequest(status)

export const isVisibleToAccess = (
  access: ResolvedCampaignAccess,
  userId: string,
  request: CampaignRequestVisibilityAccessInput,
) => {
  if (request.visibility === 'PUBLIC') return true
  if (request.createdByUserId === userId) return true
  return hasCampaignDmAccess(access)
}

export const canVoteOnRequest = (request: CampaignRequestAccessInput) =>
  request.visibility === 'PUBLIC' && isPendingRequest(request.status)

export const canEditRequest = (userId: string, request: CampaignRequestAccessInput) =>
  request.createdByUserId === userId && isPendingRequest(request.status)

export const canCancelRequest = (userId: string, request: CampaignRequestAccessInput) =>
  request.createdByUserId === userId && isPendingRequest(request.status)
