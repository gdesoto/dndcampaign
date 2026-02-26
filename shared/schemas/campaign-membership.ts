import { z } from 'zod'

export const campaignMemberRoleSchema = z.enum(['OWNER', 'COLLABORATOR', 'VIEWER'])
export const campaignManageableRoleSchema = z.enum(['COLLABORATOR', 'VIEWER'])

export const campaignInviteCreateSchema = z.object({
  email: z.string().email('Email is invalid'),
  role: campaignManageableRoleSchema,
  expiresInDays: z.number().int().min(1).max(30).optional(),
})

export const campaignMemberUpdateSchema = z
  .object({
    role: campaignManageableRoleSchema.optional(),
    hasDmAccess: z.boolean().optional(),
  })
  .refine((value) => value.role !== undefined || value.hasDmAccess !== undefined, {
    message: 'At least one member field must be provided',
    path: ['role'],
  })

export const campaignOwnerTransferSchema = z.object({
  targetMemberId: z.string().uuid('Target member id must be a UUID'),
  password: z.string().min(1, 'Password is required'),
})

export type CampaignInviteCreateInput = z.infer<typeof campaignInviteCreateSchema>
export type CampaignMemberUpdateInput = z.infer<typeof campaignMemberUpdateSchema>
export type CampaignOwnerTransferInput = z.infer<typeof campaignOwnerTransferSchema>
