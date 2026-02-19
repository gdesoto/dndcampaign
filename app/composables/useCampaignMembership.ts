type CampaignMemberRole = 'OWNER' | 'COLLABORATOR' | 'VIEWER'
type CampaignManageableRole = Exclude<CampaignMemberRole, 'OWNER'>

type CampaignMemberRow = {
  id: string
  userId: string
  role: CampaignMemberRole
  createdAt: string
  updatedAt: string
  user: {
    id: string
    email: string
    name: string
    avatarUrl: string | null
  }
}

type PendingCampaignInvite = {
  id: string
  email: string
  role: CampaignMemberRole
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED'
  expiresAt: string
  createdAt: string
  invitedByUser: {
    id: string
    name: string
    email: string
  }
}

export const useCampaignMembership = () => {
  const { request } = useApi()

  const getMembers = async (campaignId: string) =>
    request<{
      campaignId: string
      campaignName: string
      members: CampaignMemberRow[]
      pendingInvites: PendingCampaignInvite[]
    }>(`/api/campaigns/${campaignId}/members`)

  const createInvite = async (
    campaignId: string,
    payload: { email: string; role: CampaignManageableRole; expiresInDays?: number }
  ) =>
    request<{
      invite: PendingCampaignInvite
      inviteToken: string
      acceptUrl: string
    }>(`/api/campaigns/${campaignId}/members/invites`, {
      method: 'POST',
      body: payload,
    })

  const updateMemberRole = async (
    campaignId: string,
    memberId: string,
    payload: { role: CampaignManageableRole }
  ) =>
    request<{ member: CampaignMemberRow }>(`/api/campaigns/${campaignId}/members/${memberId}`, {
      method: 'PATCH',
      body: payload,
    })

  const removeMember = async (campaignId: string, memberId: string) =>
    request<{ removedMemberId: string }>(`/api/campaigns/${campaignId}/members/${memberId}`, {
      method: 'DELETE',
    })

  const transferOwnership = async (
    campaignId: string,
    payload: { targetMemberId: string; password: string }
  ) =>
    request<{
      campaignId: string
      newOwnerUserId: string
      previousOwnerUserId: string
      newOwnerMemberId: string
    }>(`/api/campaigns/${campaignId}/owner-transfer`, {
      method: 'POST',
      body: payload,
    })

  const acceptInvite = async (token: string) =>
    request<{
      campaignId: string
      campaignName: string
      role: CampaignMemberRole
    }>(`/api/campaign-invites/${token}/accept`, {
      method: 'POST',
    })

  const inspectInvite = async (token: string) =>
    request<
      | {
          status: 'CAN_ACCEPT'
          role: CampaignMemberRole
          expiresAt: string
        }
      | {
          status: 'ALREADY_MEMBER'
          campaignId: string
          campaignName: string
          role: CampaignMemberRole
        }
      | { status: 'WRONG_ACCOUNT' }
      | { status: 'INVITE_NOT_FOUND' }
      | { status: 'INVITE_EXPIRED' }
      | { status: 'INVITE_ALREADY_PROCESSED' }
    >(`/api/campaign-invites/${token}`)

  return {
    getMembers,
    createInvite,
    updateMemberRole,
    removeMember,
    transferOwnership,
    acceptInvite,
    inspectInvite,
  }
}
