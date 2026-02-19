import { z } from 'zod'

export const campaignMemberRoleSchema = z.enum(['OWNER', 'COLLABORATOR', 'VIEWER'])
export const campaignManageableRoleSchema = z.enum(['COLLABORATOR', 'VIEWER'])

export const campaignInviteCreateSchema = z.object({
  email: z.string().email('Email is invalid'),
  role: campaignManageableRoleSchema,
  expiresInDays: z.number().int().min(1).max(30).optional(),
})

export const campaignMemberRoleUpdateSchema = z.object({
  role: campaignManageableRoleSchema,
})

export const campaignOwnerTransferSchema = z.object({
  targetMemberId: z.string().uuid('Target member id must be a UUID'),
  password: z.string().min(1, 'Password is required'),
})

export type CampaignInviteCreateInput = z.infer<typeof campaignInviteCreateSchema>
export type CampaignMemberRoleUpdateInput = z.infer<typeof campaignMemberRoleUpdateSchema>
export type CampaignOwnerTransferInput = z.infer<typeof campaignOwnerTransferSchema>
