import { z } from 'zod'

const weakPasswordDenylist = new Set([
  'password',
  'password123',
  'password1234',
  '1234567890',
  'qwerty12345',
  'letmein12345',
  'admin123456',
  'welcome12345',
])

const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters long')
  .refine((password) => !weakPasswordDenylist.has(password.toLowerCase()), {
    message: 'Password is too weak',
  })

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120, 'Name is too long'),
  email: z.string().email(),
  password: passwordSchema,
  termsAccepted: z.boolean().refine((value) => value === true, {
    message: 'You must accept the terms to continue',
  }),
})

export const authUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  systemRole: z.enum(['USER', 'SYSTEM_ADMIN']),
  avatarUrl: z.string().url().nullable(),
})

export const registerResponseSchema = z.object({
  user: authUserSchema,
})

export const accountProfileResponseSchema = z.object({
  profile: authUserSchema.extend({
    isActive: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  }),
})

export const accountProfileUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    avatarUrl: z.string().url().nullable().optional(),
  })
  .refine((data) => data.name !== undefined || data.avatarUrl !== undefined, {
    message: 'At least one profile field must be provided',
  })

export const changeEmailSchema = z.object({
  newEmail: z.string().email(),
  password: z.string().min(1),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
})

export const sessionListItemSchema = z.object({
  id: z.string(),
  isCurrent: z.boolean(),
  userAgent: z.string().nullable(),
  ipAddress: z.string().nullable(),
  loggedInAt: z.string().datetime().nullable(),
  lastSeenAt: z.string().datetime(),
})

export const accountSessionsResponseSchema = z.object({
  sessions: z.array(sessionListItemSchema),
})

export const revokeOtherSessionsResponseSchema = z.object({
  revokedSessions: z.number().int().nonnegative(),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
