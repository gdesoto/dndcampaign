import { randomUUID } from 'node:crypto'
import { relations, sql, type One } from 'drizzle-orm'
import { sqliteTable, text, integer, index, uniqueIndex, primaryKey, foreignKey, type SQLiteTableExtraConfigValue } from 'drizzle-orm/sqlite-core'
import { dateTime, booleanColumn, jsonColumn } from './columns'

export const UserSystemRole = { USER: "USER", SYSTEM_ADMIN: "SYSTEM_ADMIN" } as const
export type UserSystemRole = (typeof UserSystemRole)[keyof typeof UserSystemRole]

export const CampaignRole = { OWNER: "OWNER", COLLABORATOR: "COLLABORATOR", VIEWER: "VIEWER" } as const
export type CampaignRole = (typeof CampaignRole)[keyof typeof CampaignRole]

export const CampaignInviteStatus = { PENDING: "PENDING", ACCEPTED: "ACCEPTED", REVOKED: "REVOKED", EXPIRED: "EXPIRED" } as const
export type CampaignInviteStatus = (typeof CampaignInviteStatus)[keyof typeof CampaignInviteStatus]

export const CampaignRequestType = { ITEM: "ITEM", PLOT_POINT: "PLOT_POINT" } as const
export type CampaignRequestType = (typeof CampaignRequestType)[keyof typeof CampaignRequestType]

export const CampaignRequestVisibility = { PRIVATE: "PRIVATE", PUBLIC: "PUBLIC" } as const
export type CampaignRequestVisibility = (typeof CampaignRequestVisibility)[keyof typeof CampaignRequestVisibility]

export const CampaignRequestStatus = { PENDING: "PENDING", APPROVED: "APPROVED", DENIED: "DENIED", CANCELED: "CANCELED" } as const
export type CampaignRequestStatus = (typeof CampaignRequestStatus)[keyof typeof CampaignRequestStatus]

export const CampaignJournalVisibility = { MYSELF: "MYSELF", DM: "DM", CAMPAIGN: "CAMPAIGN" } as const
export type CampaignJournalVisibility = (typeof CampaignJournalVisibility)[keyof typeof CampaignJournalVisibility]

export const CampaignJournalTagType = { CUSTOM: "CUSTOM", GLOSSARY: "GLOSSARY" } as const
export type CampaignJournalTagType = (typeof CampaignJournalTagType)[keyof typeof CampaignJournalTagType]

export const EncounterStatus = { PLANNED: "PLANNED", ACTIVE: "ACTIVE", PAUSED: "PAUSED", COMPLETED: "COMPLETED", ABANDONED: "ABANDONED" } as const
export type EncounterStatus = (typeof EncounterStatus)[keyof typeof EncounterStatus]

export const CampaignDungeonStatus = { DRAFT: "DRAFT", READY: "READY", ARCHIVED: "ARCHIVED" } as const
export type CampaignDungeonStatus = (typeof CampaignDungeonStatus)[keyof typeof CampaignDungeonStatus]

export const CampaignDungeonGridType = { SQUARE: "SQUARE" } as const
export type CampaignDungeonGridType = (typeof CampaignDungeonGridType)[keyof typeof CampaignDungeonGridType]

export const CampaignDungeonRoomState = { UNSEEN: "UNSEEN", EXPLORED: "EXPLORED", CLEARED: "CLEARED", CONTESTED: "CONTESTED" } as const
export type CampaignDungeonRoomState = (typeof CampaignDungeonRoomState)[keyof typeof CampaignDungeonRoomState]

export const CampaignDungeonLinkType = { SESSION: "SESSION", QUEST: "QUEST", MILESTONE: "MILESTONE", GLOSSARY: "GLOSSARY", ENCOUNTER: "ENCOUNTER" } as const
export type CampaignDungeonLinkType = (typeof CampaignDungeonLinkType)[keyof typeof CampaignDungeonLinkType]

export const CampaignDungeonSnapshotType = { AUTO: "AUTO", MANUAL: "MANUAL", PRE_REGENERATE: "PRE_REGENERATE" } as const
export type CampaignDungeonSnapshotType = (typeof CampaignDungeonSnapshotType)[keyof typeof CampaignDungeonSnapshotType]

export const EncounterType = { COMBAT: "COMBAT", SOCIAL: "SOCIAL", SKILL_CHALLENGE: "SKILL_CHALLENGE", CHASE: "CHASE", HAZARD: "HAZARD" } as const
export type EncounterType = (typeof EncounterType)[keyof typeof EncounterType]

export const EncounterVisibility = { DM_ONLY: "DM_ONLY", SHARED: "SHARED" } as const
export type EncounterVisibility = (typeof EncounterVisibility)[keyof typeof EncounterVisibility]

export const EncounterSide = { ALLY: "ALLY", ENEMY: "ENEMY", NEUTRAL: "NEUTRAL" } as const
export type EncounterSide = (typeof EncounterSide)[keyof typeof EncounterSide]

export const EncounterSourceType = { CAMPAIGN_CHARACTER: "CAMPAIGN_CHARACTER", PLAYER_CHARACTER: "PLAYER_CHARACTER", GLOSSARY_ENTRY: "GLOSSARY_ENTRY", CUSTOM: "CUSTOM" } as const
export type EncounterSourceType = (typeof EncounterSourceType)[keyof typeof EncounterSourceType]

export const ConditionTickTiming = { TURN_START: "TURN_START", TURN_END: "TURN_END", ROUND_END: "ROUND_END" } as const
export type ConditionTickTiming = (typeof ConditionTickTiming)[keyof typeof ConditionTickTiming]

export const EncounterEventType = { ENCOUNTER: "ENCOUNTER", TURN: "TURN", HP: "HP", CONDITION: "CONDITION", NOTE: "NOTE", SYSTEM: "SYSTEM" } as const
export type EncounterEventType = (typeof EncounterEventType)[keyof typeof EncounterEventType]

export const GlossaryType = { PC: "PC", NPC: "NPC", ITEM: "ITEM", LOCATION: "LOCATION" } as const
export type GlossaryType = (typeof GlossaryType)[keyof typeof GlossaryType]

export const CampaignMapStatus = { ACTIVE: "ACTIVE", ARCHIVED: "ARCHIVED" } as const
export type CampaignMapStatus = (typeof CampaignMapStatus)[keyof typeof CampaignMapStatus]

export const CampaignMapSourceType = { AZGAAR_FULL_JSON: "AZGAAR_FULL_JSON" } as const
export type CampaignMapSourceType = (typeof CampaignMapSourceType)[keyof typeof CampaignMapSourceType]

export const CampaignMapFileKind = { FULL_JSON: "FULL_JSON", SVG: "SVG", GEOJSON_MARKERS: "GEOJSON_MARKERS", GEOJSON_RIVERS: "GEOJSON_RIVERS", GEOJSON_ROUTES: "GEOJSON_ROUTES", GEOJSON_CELLS: "GEOJSON_CELLS" } as const
export type CampaignMapFileKind = (typeof CampaignMapFileKind)[keyof typeof CampaignMapFileKind]

export const CampaignMapFeatureType = { STATE: "STATE", PROVINCE: "PROVINCE", BURG: "BURG", MARKER: "MARKER", RIVER: "RIVER", ROUTE: "ROUTE", CELL: "CELL" } as const
export type CampaignMapFeatureType = (typeof CampaignMapFeatureType)[keyof typeof CampaignMapFeatureType]

export const CampaignMapGlossaryLinkType = { LINKED: "LINKED", MERGED: "MERGED" } as const
export type CampaignMapGlossaryLinkType = (typeof CampaignMapGlossaryLinkType)[keyof typeof CampaignMapGlossaryLinkType]

export const QuestStatus = { ACTIVE: "ACTIVE", COMPLETED: "COMPLETED", FAILED: "FAILED", ON_HOLD: "ON_HOLD" } as const
export type QuestStatus = (typeof QuestStatus)[keyof typeof QuestStatus]

export const QuestType = { CAMPAIGN: "CAMPAIGN", GUILD: "GUILD", CHARACTER: "CHARACTER" } as const
export type QuestType = (typeof QuestType)[keyof typeof QuestType]

export const QuestTrack = { MAIN: "MAIN", SIDE: "SIDE" } as const
export type QuestTrack = (typeof QuestTrack)[keyof typeof QuestTrack]

export const QuestSourceType = { FREE_TEXT: "FREE_TEXT", NPC: "NPC", CAMPAIGN_CHARACTER: "CAMPAIGN_CHARACTER" } as const
export type QuestSourceType = (typeof QuestSourceType)[keyof typeof QuestSourceType]

export const StorageProvider = { LOCAL: "LOCAL", S3: "S3", GDRIVE: "GDRIVE", DB: "DB" } as const
export type StorageProvider = (typeof StorageProvider)[keyof typeof StorageProvider]

export const RecordingKind = { AUDIO: "AUDIO", VIDEO: "VIDEO" } as const
export type RecordingKind = (typeof RecordingKind)[keyof typeof RecordingKind]

export const TranscriptionProvider = { ELEVENLABS: "ELEVENLABS" } as const
export type TranscriptionProvider = (typeof TranscriptionProvider)[keyof typeof TranscriptionProvider]

export const TranscriptionStatus = { SENDING: "SENDING", SENT: "SENT", PROCESSING: "PROCESSING", COMPLETED: "COMPLETED", FAILED: "FAILED" } as const
export type TranscriptionStatus = (typeof TranscriptionStatus)[keyof typeof TranscriptionStatus]

export const TranscriptionArtifactFormat = { TXT: "TXT", SRT: "SRT", DOCX: "DOCX", PDF: "PDF", HTML: "HTML", SEGMENTED_JSON: "SEGMENTED_JSON" } as const
export type TranscriptionArtifactFormat = (typeof TranscriptionArtifactFormat)[keyof typeof TranscriptionArtifactFormat]

export const DocumentType = { TRANSCRIPT: "TRANSCRIPT", SUMMARY: "SUMMARY", NOTES: "NOTES" } as const
export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType]

export const DocumentFormat = { MARKDOWN: "MARKDOWN", PLAINTEXT: "PLAINTEXT" } as const
export type DocumentFormat = (typeof DocumentFormat)[keyof typeof DocumentFormat]

export const DocumentSource = { USER_EDIT: "USER_EDIT", USER_IMPORT: "USER_IMPORT", SYSTEM_AUTOSAVE: "SYSTEM_AUTOSAVE", ELEVENLABS_IMPORT: "ELEVENLABS_IMPORT", N8N_IMPORT: "N8N_IMPORT" } as const
export type DocumentSource = (typeof DocumentSource)[keyof typeof DocumentSource]

export const SummaryJobStatus = { QUEUED: "QUEUED", SENT: "SENT", PROCESSING: "PROCESSING", READY_FOR_REVIEW: "READY_FOR_REVIEW", APPLIED: "APPLIED", FAILED: "FAILED" } as const
export type SummaryJobStatus = (typeof SummaryJobStatus)[keyof typeof SummaryJobStatus]

export const SummaryJobMode = { SYNC: "SYNC", ASYNC: "ASYNC" } as const
export type SummaryJobMode = (typeof SummaryJobMode)[keyof typeof SummaryJobMode]

export const SummaryJobKind = { SUMMARY_GENERATION: "SUMMARY_GENERATION", SUGGESTION_GENERATION: "SUGGESTION_GENERATION" } as const
export type SummaryJobKind = (typeof SummaryJobKind)[keyof typeof SummaryJobKind]

export const SummarySuggestionEntityType = { SESSION: "SESSION", QUEST: "QUEST", MILESTONE: "MILESTONE", GLOSSARY: "GLOSSARY", PC: "PC", NPC: "NPC", ITEM: "ITEM", LOCATION: "LOCATION" } as const
export type SummarySuggestionEntityType = (typeof SummarySuggestionEntityType)[keyof typeof SummarySuggestionEntityType]

export const SummarySuggestionAction = { CREATE: "CREATE", UPDATE: "UPDATE", DISCARD: "DISCARD" } as const
export type SummarySuggestionAction = (typeof SummarySuggestionAction)[keyof typeof SummarySuggestionAction]

export const SummarySuggestionStatus = { PENDING: "PENDING", APPLIED: "APPLIED", DISCARDED: "DISCARDED" } as const
export type SummarySuggestionStatus = (typeof SummarySuggestionStatus)[keyof typeof SummarySuggestionStatus]

export const CharacterSourceProvider = { MANUAL: "MANUAL", DND_BEYOND: "DND_BEYOND" } as const
export type CharacterSourceProvider = (typeof CharacterSourceProvider)[keyof typeof CharacterSourceProvider]

export const CharacterCampaignStatus = { ACTIVE: "ACTIVE", INACTIVE: "INACTIVE" } as const
export type CharacterCampaignStatus = (typeof CharacterCampaignStatus)[keyof typeof CharacterCampaignStatus]

export const CharacterOverwriteMode = { FULL: "FULL", SECTIONS: "SECTIONS" } as const
export type CharacterOverwriteMode = (typeof CharacterOverwriteMode)[keyof typeof CharacterOverwriteMode]

export const user = sqliteTable("User", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  email: text("email").notNull(),
  passwordHash: text("passwordHash"),
  name: text("name").notNull(),
  systemRole: text("systemRole", { enum: ["USER", "SYSTEM_ADMIN"] }).notNull().default("USER"),
  isActive: booleanColumn("isActive").notNull().default(true),
  lastLoginAt: dateTime("lastLoginAt"),
  avatarUrl: text("avatarUrl"),
  deletedAt: dateTime("deletedAt"),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
  updatedAt: dateTime("updatedAt").notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table): SQLiteTableExtraConfigValue[] => [
  index("User_email_idx").on(table.email),
  uniqueIndex("User_email_key").on(table.email),
])
export type User = typeof user.$inferSelect

export const activityLog = sqliteTable("ActivityLog", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  actorUserId: text("actorUserId"),
  campaignId: text("campaignId"),
  scope: text("scope").notNull(),
  action: text("action").notNull(),
  targetType: text("targetType"),
  targetId: text("targetId"),
  summary: text("summary"),
  metadata: jsonColumn("metadata"),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
}, (table): SQLiteTableExtraConfigValue[] => [
  index("ActivityLog_scope_action_createdAt_idx").on(table.scope, table.action, table.createdAt),
  index("ActivityLog_campaignId_createdAt_idx").on(table.campaignId, table.createdAt),
  index("ActivityLog_actorUserId_createdAt_idx").on(table.actorUserId, table.createdAt),
  index("ActivityLog_createdAt_idx").on(table.createdAt),
  foreignKey({ columns: [table.campaignId], foreignColumns: [campaign.id], name: "ActivityLog_campaignId_fkey" }).onUpdate("cascade").onDelete("set null"),
  foreignKey({ columns: [table.actorUserId], foreignColumns: [user.id], name: "ActivityLog_actorUserId_fkey" }).onUpdate("cascade").onDelete("set null"),
])
export type ActivityLog = typeof activityLog.$inferSelect

export const adminAuditLog = sqliteTable("AdminAuditLog", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  actorUserId: text("actorUserId").notNull(),
  action: text("action").notNull(),
  targetType: text("targetType").notNull(),
  targetId: text("targetId"),
  summary: text("summary"),
  metadata: jsonColumn("metadata"),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
}, (table): SQLiteTableExtraConfigValue[] => [
  index("AdminAuditLog_action_createdAt_idx").on(table.action, table.createdAt),
  index("AdminAuditLog_targetType_createdAt_idx").on(table.targetType, table.createdAt),
  index("AdminAuditLog_actorUserId_createdAt_idx").on(table.actorUserId, table.createdAt),
  foreignKey({ columns: [table.actorUserId], foreignColumns: [user.id], name: "AdminAuditLog_actorUserId_fkey" }).onUpdate("cascade").onDelete("restrict"),
])
export type AdminAuditLog = typeof adminAuditLog.$inferSelect

export const campaign = sqliteTable("Campaign", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  ownerId: text("ownerId").notNull(),
  name: text("name").notNull(),
  system: text("system").notNull().default("D&D 5e"),
  isArchived: booleanColumn("isArchived").notNull().default(false),
  dungeonMasterName: text("dungeonMasterName"),
  description: text("description"),
  currentStatus: text("currentStatus"),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
  updatedAt: dateTime("updatedAt").notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table): SQLiteTableExtraConfigValue[] => [
  index("Campaign_ownerId_idx").on(table.ownerId),
  foreignKey({ columns: [table.ownerId], foreignColumns: [user.id], name: "Campaign_ownerId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type Campaign = typeof campaign.$inferSelect

export const apiKey = sqliteTable("ApiKey", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  userId: text("userId").notNull(),
  name: text("name").notNull(),
  prefix: text("prefix").notNull(),
  keyHash: text("keyHash").notNull(),
  permissions: jsonColumn("permissions").notNull(),
  expiresAt: dateTime("expiresAt"),
  lastUsedAt: dateTime("lastUsedAt"),
  revokedAt: dateTime("revokedAt"),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
  updatedAt: dateTime("updatedAt").notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table): SQLiteTableExtraConfigValue[] => [
  index("ApiKey_expiresAt_idx").on(table.expiresAt),
  index("ApiKey_userId_revokedAt_idx").on(table.userId, table.revokedAt),
  uniqueIndex("ApiKey_keyHash_key").on(table.keyHash),
  foreignKey({ columns: [table.userId], foreignColumns: [user.id], name: "ApiKey_userId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type ApiKey = typeof apiKey.$inferSelect

export const apiKeyCampaign = sqliteTable("ApiKeyCampaign", {
  apiKeyId: text("apiKeyId").notNull(),
  campaignId: text("campaignId").notNull(),
}, (table): SQLiteTableExtraConfigValue[] => [
  primaryKey({ columns: [table.apiKeyId, table.campaignId] }),
  index("ApiKeyCampaign_campaignId_idx").on(table.campaignId),
  foreignKey({ columns: [table.campaignId], foreignColumns: [campaign.id], name: "ApiKeyCampaign_campaignId_fkey" }).onUpdate("cascade").onDelete("cascade"),
  foreignKey({ columns: [table.apiKeyId], foreignColumns: [apiKey.id], name: "ApiKeyCampaign_apiKeyId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type ApiKeyCampaign = typeof apiKeyCampaign.$inferSelect

export const campaignPublicAccess = sqliteTable("CampaignPublicAccess", {
  campaignId: text("campaignId").primaryKey().notNull(),
  isEnabled: booleanColumn("isEnabled").notNull().default(false),
  isListed: booleanColumn("isListed").notNull().default(false),
  publicSlug: text("publicSlug").notNull(),
  showCharacters: booleanColumn("showCharacters").notNull().default(false),
  showRecaps: booleanColumn("showRecaps").notNull().default(false),
  showSessions: booleanColumn("showSessions").notNull().default(false),
  showGlossary: booleanColumn("showGlossary").notNull().default(false),
  showQuests: booleanColumn("showQuests").notNull().default(false),
  showMilestones: booleanColumn("showMilestones").notNull().default(false),
  showMaps: booleanColumn("showMaps").notNull().default(false),
  showJournal: booleanColumn("showJournal").notNull().default(false),
  updatedByUserId: text("updatedByUserId").notNull(),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
  updatedAt: dateTime("updatedAt").notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table): SQLiteTableExtraConfigValue[] => [
  index("CampaignPublicAccess_isEnabled_idx").on(table.isEnabled),
  uniqueIndex("CampaignPublicAccess_publicSlug_key").on(table.publicSlug),
  foreignKey({ columns: [table.updatedByUserId], foreignColumns: [user.id], name: "CampaignPublicAccess_updatedByUserId_fkey" }).onUpdate("cascade").onDelete("restrict"),
  foreignKey({ columns: [table.campaignId], foreignColumns: [campaign.id], name: "CampaignPublicAccess_campaignId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type CampaignPublicAccess = typeof campaignPublicAccess.$inferSelect

export const campaignMember = sqliteTable("CampaignMember", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  campaignId: text("campaignId").notNull(),
  userId: text("userId").notNull(),
  role: text("role", { enum: ["OWNER", "COLLABORATOR", "VIEWER"] }).notNull(),
  invitedByUserId: text("invitedByUserId").notNull(),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
  updatedAt: dateTime("updatedAt").notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
  hasDmAccess: booleanColumn("hasDmAccess").notNull().default(false),
}, (table): SQLiteTableExtraConfigValue[] => [
  uniqueIndex("CampaignMember_campaignId_userId_key").on(table.campaignId, table.userId),
  index("CampaignMember_campaignId_role_idx").on(table.campaignId, table.role),
  index("CampaignMember_userId_idx").on(table.userId),
  foreignKey({ columns: [table.invitedByUserId], foreignColumns: [user.id], name: "CampaignMember_invitedByUserId_fkey" }).onUpdate("cascade").onDelete("restrict"),
  foreignKey({ columns: [table.userId], foreignColumns: [user.id], name: "CampaignMember_userId_fkey" }).onUpdate("cascade").onDelete("cascade"),
  foreignKey({ columns: [table.campaignId], foreignColumns: [campaign.id], name: "CampaignMember_campaignId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type CampaignMember = typeof campaignMember.$inferSelect

export const campaignInvite = sqliteTable("CampaignInvite", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  campaignId: text("campaignId").notNull(),
  email: text("email").notNull(),
  role: text("role", { enum: ["OWNER", "COLLABORATOR", "VIEWER"] }).notNull(),
  tokenHash: text("tokenHash").notNull(),
  status: text("status", { enum: ["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"] }).notNull().default("PENDING"),
  expiresAt: dateTime("expiresAt").notNull(),
  invitedByUserId: text("invitedByUserId").notNull(),
  acceptedByUserId: text("acceptedByUserId"),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
  updatedAt: dateTime("updatedAt").notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table): SQLiteTableExtraConfigValue[] => [
  index("CampaignInvite_expiresAt_idx").on(table.expiresAt),
  index("CampaignInvite_email_status_idx").on(table.email, table.status),
  index("CampaignInvite_campaignId_status_idx").on(table.campaignId, table.status),
  uniqueIndex("CampaignInvite_tokenHash_key").on(table.tokenHash),
  foreignKey({ columns: [table.acceptedByUserId], foreignColumns: [user.id], name: "CampaignInvite_acceptedByUserId_fkey" }).onUpdate("cascade").onDelete("set null"),
  foreignKey({ columns: [table.invitedByUserId], foreignColumns: [user.id], name: "CampaignInvite_invitedByUserId_fkey" }).onUpdate("cascade").onDelete("restrict"),
  foreignKey({ columns: [table.campaignId], foreignColumns: [campaign.id], name: "CampaignInvite_campaignId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type CampaignInvite = typeof campaignInvite.$inferSelect

export const campaignRequest = sqliteTable("CampaignRequest", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  campaignId: text("campaignId").notNull(),
  createdByUserId: text("createdByUserId").notNull(),
  type: text("type", { enum: ["ITEM", "PLOT_POINT"] }).notNull(),
  visibility: text("visibility", { enum: ["PRIVATE", "PUBLIC"] }).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status", { enum: ["PENDING", "APPROVED", "DENIED", "CANCELED"] }).notNull().default("PENDING"),
  decisionNote: text("decisionNote"),
  decidedByUserId: text("decidedByUserId"),
  decidedAt: dateTime("decidedAt"),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
  updatedAt: dateTime("updatedAt").notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table): SQLiteTableExtraConfigValue[] => [
  index("CampaignRequest_campaignId_status_decidedAt_idx").on(table.campaignId, table.status, table.decidedAt),
  index("CampaignRequest_campaignId_createdByUserId_createdAt_idx").on(table.campaignId, table.createdByUserId, table.createdAt),
  index("CampaignRequest_campaignId_visibility_status_createdAt_idx").on(table.campaignId, table.visibility, table.status, table.createdAt),
  foreignKey({ columns: [table.decidedByUserId], foreignColumns: [user.id], name: "CampaignRequest_decidedByUserId_fkey" }).onUpdate("cascade").onDelete("set null"),
  foreignKey({ columns: [table.createdByUserId], foreignColumns: [user.id], name: "CampaignRequest_createdByUserId_fkey" }).onUpdate("cascade").onDelete("restrict"),
  foreignKey({ columns: [table.campaignId], foreignColumns: [campaign.id], name: "CampaignRequest_campaignId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type CampaignRequest = typeof campaignRequest.$inferSelect

export const campaignRequestVote = sqliteTable("CampaignRequestVote", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  campaignRequestId: text("campaignRequestId").notNull(),
  campaignId: text("campaignId").notNull(),
  userId: text("userId").notNull(),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
}, (table): SQLiteTableExtraConfigValue[] => [
  uniqueIndex("CampaignRequestVote_campaignRequestId_userId_key").on(table.campaignRequestId, table.userId),
  index("CampaignRequestVote_campaignId_userId_createdAt_idx").on(table.campaignId, table.userId, table.createdAt),
  index("CampaignRequestVote_campaignRequestId_createdAt_idx").on(table.campaignRequestId, table.createdAt),
  foreignKey({ columns: [table.userId], foreignColumns: [user.id], name: "CampaignRequestVote_userId_fkey" }).onUpdate("cascade").onDelete("cascade"),
  foreignKey({ columns: [table.campaignId], foreignColumns: [campaign.id], name: "CampaignRequestVote_campaignId_fkey" }).onUpdate("cascade").onDelete("cascade"),
  foreignKey({ columns: [table.campaignRequestId], foreignColumns: [campaignRequest.id], name: "CampaignRequestVote_campaignRequestId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type CampaignRequestVote = typeof campaignRequestVote.$inferSelect

export const campaignJournalEntry = sqliteTable("CampaignJournalEntry", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  campaignId: text("campaignId").notNull(),
  authorUserId: text("authorUserId").notNull(),
  holderUserId: text("holderUserId"),
  discoveredByUserId: text("discoveredByUserId"),
  archivedByUserId: text("archivedByUserId"),
  title: text("title").notNull(),
  contentMarkdown: text("contentMarkdown").notNull(),
  visibility: text("visibility", { enum: ["MYSELF", "DM", "CAMPAIGN"] }).notNull().default("MYSELF"),
  isDiscoverable: booleanColumn("isDiscoverable").notNull().default(false),
  discoveredAt: dateTime("discoveredAt"),
  isArchived: booleanColumn("isArchived").notNull().default(false),
  archivedAt: dateTime("archivedAt"),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
  updatedAt: dateTime("updatedAt").notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table): SQLiteTableExtraConfigValue[] => [
  index("CampaignJournalEntry_campaignId_isArchived_updatedAt_idx").on(table.campaignId, table.isArchived, table.updatedAt),
  index("CampaignJournalEntry_campaignId_holderUserId_updatedAt_idx").on(table.campaignId, table.holderUserId, table.updatedAt),
  index("CampaignJournalEntry_campaignId_isDiscoverable_updatedAt_idx").on(table.campaignId, table.isDiscoverable, table.updatedAt),
  index("CampaignJournalEntry_campaignId_createdAt_idx").on(table.campaignId, table.createdAt),
  index("CampaignJournalEntry_campaignId_authorUserId_createdAt_idx").on(table.campaignId, table.authorUserId, table.createdAt),
  index("CampaignJournalEntry_campaignId_visibility_createdAt_idx").on(table.campaignId, table.visibility, table.createdAt),
  foreignKey({ columns: [table.archivedByUserId], foreignColumns: [user.id], name: "CampaignJournalEntry_archivedByUserId_fkey" }).onUpdate("cascade").onDelete("set null"),
  foreignKey({ columns: [table.discoveredByUserId], foreignColumns: [user.id], name: "CampaignJournalEntry_discoveredByUserId_fkey" }).onUpdate("cascade").onDelete("set null"),
  foreignKey({ columns: [table.holderUserId], foreignColumns: [user.id], name: "CampaignJournalEntry_holderUserId_fkey" }).onUpdate("cascade").onDelete("set null"),
  foreignKey({ columns: [table.authorUserId], foreignColumns: [user.id], name: "CampaignJournalEntry_authorUserId_fkey" }).onUpdate("cascade").onDelete("restrict"),
  foreignKey({ columns: [table.campaignId], foreignColumns: [campaign.id], name: "CampaignJournalEntry_campaignId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type CampaignJournalEntry = typeof campaignJournalEntry.$inferSelect

export const campaignJournalTag = sqliteTable("CampaignJournalTag", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  campaignJournalEntryId: text("campaignJournalEntryId").notNull(),
  campaignId: text("campaignId").notNull(),
  tagType: text("tagType", { enum: ["CUSTOM", "GLOSSARY"] }).notNull(),
  normalizedLabel: text("normalizedLabel").notNull(),
  displayLabel: text("displayLabel").notNull(),
  glossaryEntryId: text("glossaryEntryId"),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
}, (table): SQLiteTableExtraConfigValue[] => [
  uniqueIndex("CampaignJournalTag_campaignJournalEntryId_tagType_normalizedLabel_key").on(table.campaignJournalEntryId, table.tagType, table.normalizedLabel),
  index("CampaignJournalTag_campaignId_glossaryEntryId_idx").on(table.campaignId, table.glossaryEntryId),
  index("CampaignJournalTag_campaignJournalEntryId_tagType_idx").on(table.campaignJournalEntryId, table.tagType),
  index("CampaignJournalTag_campaignId_normalizedLabel_idx").on(table.campaignId, table.normalizedLabel),
  foreignKey({ columns: [table.glossaryEntryId], foreignColumns: [glossaryEntry.id], name: "CampaignJournalTag_glossaryEntryId_fkey" }).onUpdate("cascade").onDelete("set null"),
  foreignKey({ columns: [table.campaignId], foreignColumns: [campaign.id], name: "CampaignJournalTag_campaignId_fkey" }).onUpdate("cascade").onDelete("cascade"),
  foreignKey({ columns: [table.campaignJournalEntryId], foreignColumns: [campaignJournalEntry.id], name: "CampaignJournalTag_campaignJournalEntryId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type CampaignJournalTag = typeof campaignJournalTag.$inferSelect

export const campaignJournalEntrySessionLink = sqliteTable("CampaignJournalEntrySessionLink", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  campaignJournalEntryId: text("campaignJournalEntryId").notNull(),
  sessionId: text("sessionId").notNull(),
  campaignId: text("campaignId").notNull(),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
}, (table): SQLiteTableExtraConfigValue[] => [
  uniqueIndex("CampaignJournalEntrySessionLink_campaignJournalEntryId_sessionId_key").on(table.campaignJournalEntryId, table.sessionId),
  index("CampaignJournalEntrySessionLink_campaignJournalEntryId_createdAt_idx").on(table.campaignJournalEntryId, table.createdAt),
  index("CampaignJournalEntrySessionLink_campaignId_sessionId_idx").on(table.campaignId, table.sessionId),
  foreignKey({ columns: [table.campaignId], foreignColumns: [campaign.id], name: "CampaignJournalEntrySessionLink_campaignId_fkey" }).onUpdate("cascade").onDelete("cascade"),
  foreignKey({ columns: [table.sessionId, table.campaignId], foreignColumns: [session.id, session.campaignId], name: "CampaignJournalEntrySessionLink_sessionId_campaignId_fkey" }).onUpdate("cascade").onDelete("cascade"),
  foreignKey({ columns: [table.campaignJournalEntryId], foreignColumns: [campaignJournalEntry.id], name: "CampaignJournalEntrySessionLink_campaignJournalEntryId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type CampaignJournalEntrySessionLink = typeof campaignJournalEntrySessionLink.$inferSelect

export const campaignJournalEntryTransferHistory = sqliteTable("CampaignJournalEntryTransferHistory", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  campaignJournalEntryId: text("campaignJournalEntryId").notNull(),
  campaignId: text("campaignId").notNull(),
  fromHolderUserId: text("fromHolderUserId"),
  toHolderUserId: text("toHolderUserId"),
  actorUserId: text("actorUserId").notNull(),
  action: text("action").notNull(),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
}, (table): SQLiteTableExtraConfigValue[] => [
  index("CampaignJournalEntryTransferHistory_campaignId_createdAt_idx").on(table.campaignId, table.createdAt),
  index("CampaignJournalEntryTransferHistory_campaignJournalEntryId_createdAt_idx").on(table.campaignJournalEntryId, table.createdAt),
  foreignKey({ columns: [table.actorUserId], foreignColumns: [user.id], name: "CampaignJournalEntryTransferHistory_actorUserId_fkey" }).onUpdate("cascade").onDelete("restrict"),
  foreignKey({ columns: [table.toHolderUserId], foreignColumns: [user.id], name: "CampaignJournalEntryTransferHistory_toHolderUserId_fkey" }).onUpdate("cascade").onDelete("set null"),
  foreignKey({ columns: [table.fromHolderUserId], foreignColumns: [user.id], name: "CampaignJournalEntryTransferHistory_fromHolderUserId_fkey" }).onUpdate("cascade").onDelete("set null"),
  foreignKey({ columns: [table.campaignId], foreignColumns: [campaign.id], name: "CampaignJournalEntryTransferHistory_campaignId_fkey" }).onUpdate("cascade").onDelete("cascade"),
  foreignKey({ columns: [table.campaignJournalEntryId], foreignColumns: [campaignJournalEntry.id], name: "CampaignJournalEntryTransferHistory_campaignJournalEntryId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type CampaignJournalEntryTransferHistory = typeof campaignJournalEntryTransferHistory.$inferSelect

export const session = sqliteTable("Session", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  campaignId: text("campaignId").notNull(),
  title: text("title").notNull(),
  sessionNumber: integer("sessionNumber"),
  playedAt: dateTime("playedAt"),
  notes: text("notes"),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
  updatedAt: dateTime("updatedAt").notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
  guestDungeonMasterName: text("guestDungeonMasterName"),
}, (table): SQLiteTableExtraConfigValue[] => [
  uniqueIndex("Session_id_campaignId_key").on(table.id, table.campaignId),
  index("Session_campaignId_idx").on(table.campaignId),
  foreignKey({ columns: [table.campaignId], foreignColumns: [campaign.id], name: "Session_campaignId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type Session = typeof session.$inferSelect

export const campaignCalendarConfig = sqliteTable("CampaignCalendarConfig", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  campaignId: text("campaignId").notNull(),
  isEnabled: booleanColumn("isEnabled").notNull().default(false),
  name: text("name").notNull(),
  startingYear: integer("startingYear").notNull(),
  firstWeekdayIndex: integer("firstWeekdayIndex").notNull(),
  currentYear: integer("currentYear").notNull(),
  currentMonth: integer("currentMonth").notNull(),
  currentDay: integer("currentDay").notNull(),
  weekdaysJson: jsonColumn("weekdaysJson").notNull(),
  monthsJson: jsonColumn("monthsJson").notNull(),
  moonsJson: jsonColumn("moonsJson").notNull(),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
  updatedAt: dateTime("updatedAt").notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table): SQLiteTableExtraConfigValue[] => [
  index("CampaignCalendarConfig_campaignId_isEnabled_idx").on(table.campaignId, table.isEnabled),
  uniqueIndex("CampaignCalendarConfig_campaignId_key").on(table.campaignId),
  foreignKey({ columns: [table.campaignId], foreignColumns: [campaign.id], name: "CampaignCalendarConfig_campaignId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type CampaignCalendarConfig = typeof campaignCalendarConfig.$inferSelect

export const sessionCalendarRange = sqliteTable("SessionCalendarRange", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  sessionId: text("sessionId").notNull(),
  campaignId: text("campaignId").notNull(),
  startYear: integer("startYear").notNull(),
  startMonth: integer("startMonth").notNull(),
  startDay: integer("startDay").notNull(),
  endYear: integer("endYear").notNull(),
  endMonth: integer("endMonth").notNull(),
  endDay: integer("endDay").notNull(),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
  updatedAt: dateTime("updatedAt").notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table): SQLiteTableExtraConfigValue[] => [
  uniqueIndex("SessionCalendarRange_sessionId_campaignId_key").on(table.sessionId, table.campaignId),
  index("SessionCalendarRange_campaignId_endYear_endMonth_endDay_idx").on(table.campaignId, table.endYear, table.endMonth, table.endDay),
  index("SessionCalendarRange_campaignId_startYear_startMonth_startDay_idx").on(table.campaignId, table.startYear, table.startMonth, table.startDay),
  index("SessionCalendarRange_campaignId_idx").on(table.campaignId),
  uniqueIndex("SessionCalendarRange_sessionId_key").on(table.sessionId),
  foreignKey({ columns: [table.campaignId], foreignColumns: [campaign.id], name: "SessionCalendarRange_campaignId_fkey" }).onUpdate("cascade").onDelete("cascade"),
  foreignKey({ columns: [table.sessionId, table.campaignId], foreignColumns: [session.id, session.campaignId], name: "SessionCalendarRange_sessionId_campaignId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type SessionCalendarRange = typeof sessionCalendarRange.$inferSelect

export const campaignCalendarEvent = sqliteTable("CampaignCalendarEvent", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  campaignId: text("campaignId").notNull(),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  day: integer("day").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  createdByUserId: text("createdByUserId").notNull(),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
  updatedAt: dateTime("updatedAt").notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table): SQLiteTableExtraConfigValue[] => [
  index("CampaignCalendarEvent_createdByUserId_idx").on(table.createdByUserId),
  index("CampaignCalendarEvent_campaignId_createdAt_idx").on(table.campaignId, table.createdAt),
  index("CampaignCalendarEvent_campaignId_year_month_day_idx").on(table.campaignId, table.year, table.month, table.day),
  foreignKey({ columns: [table.createdByUserId], foreignColumns: [user.id], name: "CampaignCalendarEvent_createdByUserId_fkey" }).onUpdate("cascade").onDelete("restrict"),
  foreignKey({ columns: [table.campaignId], foreignColumns: [campaign.id], name: "CampaignCalendarEvent_campaignId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type CampaignCalendarEvent = typeof campaignCalendarEvent.$inferSelect

export const campaignEncounter = sqliteTable("CampaignEncounter", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  campaignId: text("campaignId").notNull(),
  sessionId: text("sessionId"),
  name: text("name").notNull(),
  type: text("type", { enum: ["COMBAT", "SOCIAL", "SKILL_CHALLENGE", "CHASE", "HAZARD"] }).notNull().default("COMBAT"),
  status: text("status", { enum: ["PLANNED", "ACTIVE", "PAUSED", "COMPLETED", "ABANDONED"] }).notNull().default("PLANNED"),
  visibility: text("visibility", { enum: ["DM_ONLY", "SHARED"] }).notNull().default("SHARED"),
  notes: text("notes"),
  calendarYear: integer("calendarYear"),
  calendarMonth: integer("calendarMonth"),
  calendarDay: integer("calendarDay"),
  currentRound: integer("currentRound").notNull().default(1),
  currentTurnIndex: integer("currentTurnIndex").notNull().default(0),
  createdByUserId: text("createdByUserId").notNull(),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
  updatedAt: dateTime("updatedAt").notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table): SQLiteTableExtraConfigValue[] => [
  index("CampaignEncounter_createdByUserId_idx").on(table.createdByUserId),
  index("CampaignEncounter_sessionId_idx").on(table.sessionId),
  index("CampaignEncounter_campaignId_status_updatedAt_idx").on(table.campaignId, table.status, table.updatedAt),
  index("CampaignEncounter_campaignId_createdAt_idx").on(table.campaignId, table.createdAt),
  foreignKey({ columns: [table.createdByUserId], foreignColumns: [user.id], name: "CampaignEncounter_createdByUserId_fkey" }).onUpdate("cascade").onDelete("restrict"),
  foreignKey({ columns: [table.sessionId], foreignColumns: [session.id], name: "CampaignEncounter_sessionId_fkey" }).onUpdate("cascade").onDelete("set null"),
  foreignKey({ columns: [table.campaignId], foreignColumns: [campaign.id], name: "CampaignEncounter_campaignId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type CampaignEncounter = typeof campaignEncounter.$inferSelect

export const encounterCombatant = sqliteTable("EncounterCombatant", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  encounterId: text("encounterId").notNull(),
  name: text("name").notNull(),
  side: text("side", { enum: ["ALLY", "ENEMY", "NEUTRAL"] }).notNull().default("ENEMY"),
  sourceType: text("sourceType", { enum: ["CAMPAIGN_CHARACTER", "PLAYER_CHARACTER", "GLOSSARY_ENTRY", "CUSTOM"] }).notNull().default("CUSTOM"),
  sourceCampaignCharacterId: text("sourceCampaignCharacterId"),
  sourcePlayerCharacterId: text("sourcePlayerCharacterId"),
  sourceGlossaryEntryId: text("sourceGlossaryEntryId"),
  sourceStatBlockId: text("sourceStatBlockId"),
  initiative: integer("initiative"),
  sortOrder: integer("sortOrder").notNull(),
  maxHp: integer("maxHp"),
  currentHp: integer("currentHp"),
  tempHp: integer("tempHp").notNull().default(0),
  armorClass: integer("armorClass"),
  speed: integer("speed"),
  isConcentrating: booleanColumn("isConcentrating").notNull().default(false),
  deathSaveSuccesses: integer("deathSaveSuccesses").notNull().default(0),
  deathSaveFailures: integer("deathSaveFailures").notNull().default(0),
  isDefeated: booleanColumn("isDefeated").notNull().default(false),
  isHidden: booleanColumn("isHidden").notNull().default(false),
  notes: text("notes"),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
  updatedAt: dateTime("updatedAt").notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table): SQLiteTableExtraConfigValue[] => [
  uniqueIndex("EncounterCombatant_encounterId_sortOrder_key").on(table.encounterId, table.sortOrder),
  index("EncounterCombatant_sourceStatBlockId_idx").on(table.sourceStatBlockId),
  index("EncounterCombatant_encounterId_initiative_idx").on(table.encounterId, table.initiative),
  index("EncounterCombatant_encounterId_sortOrder_idx").on(table.encounterId, table.sortOrder),
  foreignKey({ columns: [table.encounterId], foreignColumns: [campaignEncounter.id], name: "EncounterCombatant_encounterId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type EncounterCombatant = typeof encounterCombatant.$inferSelect

export const encounterCondition = sqliteTable("EncounterCondition", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  combatantId: text("combatantId").notNull(),
  name: text("name").notNull(),
  duration: integer("duration"),
  remaining: integer("remaining"),
  tickTiming: text("tickTiming", { enum: ["TURN_START", "TURN_END", "ROUND_END"] }).notNull().default("TURN_END"),
  source: text("source"),
  notes: text("notes"),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
  updatedAt: dateTime("updatedAt").notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table): SQLiteTableExtraConfigValue[] => [
  index("EncounterCondition_combatantId_createdAt_idx").on(table.combatantId, table.createdAt),
  foreignKey({ columns: [table.combatantId], foreignColumns: [encounterCombatant.id], name: "EncounterCondition_combatantId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type EncounterCondition = typeof encounterCondition.$inferSelect

export const encounterEvent = sqliteTable("EncounterEvent", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  encounterId: text("encounterId").notNull(),
  eventType: text("eventType", { enum: ["ENCOUNTER", "TURN", "HP", "CONDITION", "NOTE", "SYSTEM"] }).notNull(),
  summary: text("summary").notNull(),
  payload: jsonColumn("payload"),
  createdByUserId: text("createdByUserId"),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
}, (table): SQLiteTableExtraConfigValue[] => [
  index("EncounterEvent_createdByUserId_idx").on(table.createdByUserId),
  index("EncounterEvent_eventType_createdAt_idx").on(table.eventType, table.createdAt),
  index("EncounterEvent_encounterId_createdAt_idx").on(table.encounterId, table.createdAt),
  foreignKey({ columns: [table.createdByUserId], foreignColumns: [user.id], name: "EncounterEvent_createdByUserId_fkey" }).onUpdate("cascade").onDelete("set null"),
  foreignKey({ columns: [table.encounterId], foreignColumns: [campaignEncounter.id], name: "EncounterEvent_encounterId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type EncounterEvent = typeof encounterEvent.$inferSelect

export const encounterTemplate = sqliteTable("EncounterTemplate", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  campaignId: text("campaignId").notNull(),
  name: text("name").notNull(),
  type: text("type", { enum: ["COMBAT", "SOCIAL", "SKILL_CHALLENGE", "CHASE", "HAZARD"] }).notNull().default("COMBAT"),
  notes: text("notes"),
  createdByUserId: text("createdByUserId").notNull(),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
  updatedAt: dateTime("updatedAt").notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table): SQLiteTableExtraConfigValue[] => [
  index("EncounterTemplate_createdByUserId_idx").on(table.createdByUserId),
  index("EncounterTemplate_campaignId_createdAt_idx").on(table.campaignId, table.createdAt),
  foreignKey({ columns: [table.createdByUserId], foreignColumns: [user.id], name: "EncounterTemplate_createdByUserId_fkey" }).onUpdate("cascade").onDelete("restrict"),
  foreignKey({ columns: [table.campaignId], foreignColumns: [campaign.id], name: "EncounterTemplate_campaignId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type EncounterTemplate = typeof encounterTemplate.$inferSelect

export const encounterTemplateCombatant = sqliteTable("EncounterTemplateCombatant", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  templateId: text("templateId").notNull(),
  name: text("name").notNull(),
  side: text("side", { enum: ["ALLY", "ENEMY", "NEUTRAL"] }).notNull().default("ENEMY"),
  sourceType: text("sourceType", { enum: ["CAMPAIGN_CHARACTER", "PLAYER_CHARACTER", "GLOSSARY_ENTRY", "CUSTOM"] }).notNull().default("CUSTOM"),
  sourceStatBlockId: text("sourceStatBlockId"),
  maxHp: integer("maxHp"),
  armorClass: integer("armorClass"),
  speed: integer("speed"),
  quantity: integer("quantity").notNull().default(1),
  sortOrder: integer("sortOrder").notNull(),
  notes: text("notes"),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
  updatedAt: dateTime("updatedAt").notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table): SQLiteTableExtraConfigValue[] => [
  uniqueIndex("EncounterTemplateCombatant_templateId_sortOrder_key").on(table.templateId, table.sortOrder),
  index("EncounterTemplateCombatant_templateId_sortOrder_idx").on(table.templateId, table.sortOrder),
  foreignKey({ columns: [table.templateId], foreignColumns: [encounterTemplate.id], name: "EncounterTemplateCombatant_templateId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type EncounterTemplateCombatant = typeof encounterTemplateCombatant.$inferSelect

export const encounterStatBlock = sqliteTable("EncounterStatBlock", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  campaignId: text("campaignId").notNull(),
  name: text("name").notNull(),
  challengeRating: text("challengeRating"),
  statBlockJson: jsonColumn("statBlockJson").notNull(),
  notes: text("notes"),
  createdByUserId: text("createdByUserId").notNull(),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
  updatedAt: dateTime("updatedAt").notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table): SQLiteTableExtraConfigValue[] => [
  uniqueIndex("EncounterStatBlock_campaignId_name_key").on(table.campaignId, table.name),
  index("EncounterStatBlock_createdByUserId_idx").on(table.createdByUserId),
  index("EncounterStatBlock_campaignId_createdAt_idx").on(table.campaignId, table.createdAt),
  foreignKey({ columns: [table.createdByUserId], foreignColumns: [user.id], name: "EncounterStatBlock_createdByUserId_fkey" }).onUpdate("cascade").onDelete("restrict"),
  foreignKey({ columns: [table.campaignId], foreignColumns: [campaign.id], name: "EncounterStatBlock_campaignId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type EncounterStatBlock = typeof encounterStatBlock.$inferSelect

export const campaignDungeon = sqliteTable("CampaignDungeon", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  campaignId: text("campaignId").notNull(),
  name: text("name").notNull(),
  status: text("status", { enum: ["DRAFT", "READY", "ARCHIVED"] }).notNull().default("DRAFT"),
  theme: text("theme").notNull(),
  seed: text("seed").notNull(),
  gridType: text("gridType", { enum: ["SQUARE"] }).notNull().default("SQUARE"),
  generatorVersion: text("generatorVersion").notNull(),
  configJson: jsonColumn("configJson").notNull(),
  mapJson: jsonColumn("mapJson").notNull(),
  playerViewJson: jsonColumn("playerViewJson"),
  createdByUserId: text("createdByUserId").notNull(),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
  updatedAt: dateTime("updatedAt").notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table): SQLiteTableExtraConfigValue[] => [
  index("CampaignDungeon_createdByUserId_idx").on(table.createdByUserId),
  index("CampaignDungeon_campaignId_status_updatedAt_idx").on(table.campaignId, table.status, table.updatedAt),
  index("CampaignDungeon_campaignId_updatedAt_idx").on(table.campaignId, table.updatedAt),
  foreignKey({ columns: [table.createdByUserId], foreignColumns: [user.id], name: "CampaignDungeon_createdByUserId_fkey" }).onUpdate("cascade").onDelete("restrict"),
  foreignKey({ columns: [table.campaignId], foreignColumns: [campaign.id], name: "CampaignDungeon_campaignId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type CampaignDungeon = typeof campaignDungeon.$inferSelect

export const campaignDungeonRoom = sqliteTable("CampaignDungeonRoom", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  dungeonId: text("dungeonId").notNull(),
  roomNumber: integer("roomNumber").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  gmNotes: text("gmNotes"),
  playerNotes: text("playerNotes"),
  readAloud: text("readAloud"),
  tagsJson: jsonColumn("tagsJson"),
  boundsJson: jsonColumn("boundsJson"),
  state: text("state", { enum: ["UNSEEN", "EXPLORED", "CLEARED", "CONTESTED"] }).notNull().default("UNSEEN"),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
  updatedAt: dateTime("updatedAt").notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table): SQLiteTableExtraConfigValue[] => [
  uniqueIndex("CampaignDungeonRoom_dungeonId_roomNumber_key").on(table.dungeonId, table.roomNumber),
  index("CampaignDungeonRoom_dungeonId_roomNumber_idx").on(table.dungeonId, table.roomNumber),
  foreignKey({ columns: [table.dungeonId], foreignColumns: [campaignDungeon.id], name: "CampaignDungeonRoom_dungeonId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type CampaignDungeonRoom = typeof campaignDungeonRoom.$inferSelect

export const campaignDungeonLink = sqliteTable("CampaignDungeonLink", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  dungeonId: text("dungeonId").notNull(),
  roomId: text("roomId"),
  linkType: text("linkType", { enum: ["SESSION", "QUEST", "MILESTONE", "GLOSSARY", "ENCOUNTER"] }).notNull(),
  targetId: text("targetId").notNull(),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
}, (table): SQLiteTableExtraConfigValue[] => [
  index("CampaignDungeonLink_linkType_targetId_idx").on(table.linkType, table.targetId),
  index("CampaignDungeonLink_roomId_idx").on(table.roomId),
  index("CampaignDungeonLink_dungeonId_createdAt_idx").on(table.dungeonId, table.createdAt),
  foreignKey({ columns: [table.roomId], foreignColumns: [campaignDungeonRoom.id], name: "CampaignDungeonLink_roomId_fkey" }).onUpdate("cascade").onDelete("set null"),
  foreignKey({ columns: [table.dungeonId], foreignColumns: [campaignDungeon.id], name: "CampaignDungeonLink_dungeonId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type CampaignDungeonLink = typeof campaignDungeonLink.$inferSelect

export const campaignDungeonSnapshot = sqliteTable("CampaignDungeonSnapshot", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  dungeonId: text("dungeonId").notNull(),
  snapshotType: text("snapshotType", { enum: ["AUTO", "MANUAL", "PRE_REGENERATE"] }).notNull(),
  seed: text("seed").notNull(),
  generatorVersion: text("generatorVersion").notNull(),
  configJson: jsonColumn("configJson").notNull(),
  mapJson: jsonColumn("mapJson").notNull(),
  createdByUserId: text("createdByUserId").notNull(),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
}, (table): SQLiteTableExtraConfigValue[] => [
  index("CampaignDungeonSnapshot_createdByUserId_idx").on(table.createdByUserId),
  index("CampaignDungeonSnapshot_dungeonId_createdAt_idx").on(table.dungeonId, table.createdAt),
  foreignKey({ columns: [table.createdByUserId], foreignColumns: [user.id], name: "CampaignDungeonSnapshot_createdByUserId_fkey" }).onUpdate("cascade").onDelete("restrict"),
  foreignKey({ columns: [table.dungeonId], foreignColumns: [campaignDungeon.id], name: "CampaignDungeonSnapshot_dungeonId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type CampaignDungeonSnapshot = typeof campaignDungeonSnapshot.$inferSelect

export const glossaryEntry = sqliteTable("GlossaryEntry", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  campaignId: text("campaignId").notNull(),
  type: text("type", { enum: ["PC", "NPC", "ITEM", "LOCATION"] }).notNull(),
  name: text("name").notNull(),
  aliases: text("aliases"),
  description: text("description").notNull(),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
  updatedAt: dateTime("updatedAt").notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
  sourceMapId: text("sourceMapId"),
  sourceMapFeatureId: text("sourceMapFeatureId"),
}, (table): SQLiteTableExtraConfigValue[] => [
  index("GlossaryEntry_sourceMapFeatureId_idx").on(table.sourceMapFeatureId),
  index("GlossaryEntry_sourceMapId_idx").on(table.sourceMapId),
  index("GlossaryEntry_campaignId_type_idx").on(table.campaignId, table.type),
  foreignKey({ columns: [table.sourceMapFeatureId], foreignColumns: [campaignMapFeature.id], name: "GlossaryEntry_sourceMapFeatureId_fkey" }).onUpdate("cascade").onDelete("set null"),
  foreignKey({ columns: [table.sourceMapId], foreignColumns: [campaignMap.id], name: "GlossaryEntry_sourceMapId_fkey" }).onUpdate("cascade").onDelete("set null"),
  foreignKey({ columns: [table.campaignId], foreignColumns: [campaign.id], name: "GlossaryEntry_campaignId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type GlossaryEntry = typeof glossaryEntry.$inferSelect

export const campaignMap = sqliteTable("CampaignMap", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  campaignId: text("campaignId").notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  isPrimary: booleanColumn("isPrimary").notNull().default(false),
  status: text("status", { enum: ["ACTIVE", "ARCHIVED"] }).notNull().default("ACTIVE"),
  sourceType: text("sourceType", { enum: ["AZGAAR_FULL_JSON"] }).notNull().default("AZGAAR_FULL_JSON"),
  createdById: text("createdById").notNull(),
  rawManifestJson: jsonColumn("rawManifestJson"),
  importVersion: integer("importVersion").notNull().default(1),
  sourceFingerprint: text("sourceFingerprint").notNull(),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
  updatedAt: dateTime("updatedAt").notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table): SQLiteTableExtraConfigValue[] => [
  uniqueIndex("CampaignMap_campaignId_slug_key").on(table.campaignId, table.slug),
  index("CampaignMap_campaignId_isPrimary_idx").on(table.campaignId, table.isPrimary),
  index("CampaignMap_campaignId_idx").on(table.campaignId),
  foreignKey({ columns: [table.campaignId], foreignColumns: [campaign.id], name: "CampaignMap_campaignId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type CampaignMap = typeof campaignMap.$inferSelect

export const campaignMapFile = sqliteTable("CampaignMapFile", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  campaignMapId: text("campaignMapId").notNull(),
  kind: text("kind", { enum: ["FULL_JSON", "SVG", "GEOJSON_MARKERS", "GEOJSON_RIVERS", "GEOJSON_ROUTES", "GEOJSON_CELLS"] }).notNull(),
  storageProvider: text("storageProvider", { enum: ["LOCAL", "S3", "GDRIVE", "DB"] }).notNull(),
  storageKey: text("storageKey").notNull(),
  contentType: text("contentType").notNull(),
  sizeBytes: integer("sizeBytes").notNull(),
  checksum: text("checksum"),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
}, (table): SQLiteTableExtraConfigValue[] => [
  index("CampaignMapFile_kind_idx").on(table.kind),
  index("CampaignMapFile_campaignMapId_idx").on(table.campaignMapId),
  foreignKey({ columns: [table.campaignMapId], foreignColumns: [campaignMap.id], name: "CampaignMapFile_campaignMapId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type CampaignMapFile = typeof campaignMapFile.$inferSelect

export const campaignMapFeature = sqliteTable("CampaignMapFeature", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  campaignMapId: text("campaignMapId").notNull(),
  externalId: text("externalId").notNull(),
  featureType: text("featureType", { enum: ["STATE", "PROVINCE", "BURG", "MARKER", "RIVER", "ROUTE", "CELL"] }).notNull(),
  name: text("name").notNull(),
  displayName: text("displayName").notNull(),
  normalizedName: text("normalizedName").notNull(),
  description: text("description"),
  geometryType: text("geometryType").notNull(),
  geometryJson: jsonColumn("geometryJson").notNull(),
  propertiesJson: jsonColumn("propertiesJson"),
  sourceRef: text("sourceRef").notNull(),
  isActive: booleanColumn("isActive").notNull().default(true),
  removed: booleanColumn("removed").notNull().default(false),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
  updatedAt: dateTime("updatedAt").notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table): SQLiteTableExtraConfigValue[] => [
  uniqueIndex("CampaignMapFeature_campaignMapId_featureType_externalId_key").on(table.campaignMapId, table.featureType, table.externalId),
  index("CampaignMapFeature_campaignMapId_normalizedName_idx").on(table.campaignMapId, table.normalizedName),
  index("CampaignMapFeature_campaignMapId_featureType_idx").on(table.campaignMapId, table.featureType),
  index("CampaignMapFeature_campaignMapId_idx").on(table.campaignMapId),
  foreignKey({ columns: [table.campaignMapId], foreignColumns: [campaignMap.id], name: "CampaignMapFeature_campaignMapId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type CampaignMapFeature = typeof campaignMapFeature.$inferSelect

export const campaignMapGlossaryLink = sqliteTable("CampaignMapGlossaryLink", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  campaignMapId: text("campaignMapId").notNull(),
  mapFeatureId: text("mapFeatureId").notNull(),
  glossaryEntryId: text("glossaryEntryId").notNull(),
  linkType: text("linkType", { enum: ["LINKED", "MERGED"] }).notNull(),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
}, (table): SQLiteTableExtraConfigValue[] => [
  uniqueIndex("CampaignMapGlossaryLink_mapFeatureId_glossaryEntryId_key").on(table.mapFeatureId, table.glossaryEntryId),
  index("CampaignMapGlossaryLink_glossaryEntryId_idx").on(table.glossaryEntryId),
  index("CampaignMapGlossaryLink_campaignMapId_idx").on(table.campaignMapId),
  foreignKey({ columns: [table.glossaryEntryId], foreignColumns: [glossaryEntry.id], name: "CampaignMapGlossaryLink_glossaryEntryId_fkey" }).onUpdate("cascade").onDelete("cascade"),
  foreignKey({ columns: [table.mapFeatureId], foreignColumns: [campaignMapFeature.id], name: "CampaignMapGlossaryLink_mapFeatureId_fkey" }).onUpdate("cascade").onDelete("cascade"),
  foreignKey({ columns: [table.campaignMapId], foreignColumns: [campaignMap.id], name: "CampaignMapGlossaryLink_campaignMapId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type CampaignMapGlossaryLink = typeof campaignMapGlossaryLink.$inferSelect

export const glossarySessionLink = sqliteTable("GlossarySessionLink", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  glossaryEntryId: text("glossaryEntryId").notNull(),
  sessionId: text("sessionId").notNull(),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
}, (table): SQLiteTableExtraConfigValue[] => [
  uniqueIndex("GlossarySessionLink_glossaryEntryId_sessionId_key").on(table.glossaryEntryId, table.sessionId),
  index("GlossarySessionLink_sessionId_idx").on(table.sessionId),
  foreignKey({ columns: [table.sessionId], foreignColumns: [session.id], name: "GlossarySessionLink_sessionId_fkey" }).onUpdate("cascade").onDelete("cascade"),
  foreignKey({ columns: [table.glossaryEntryId], foreignColumns: [glossaryEntry.id], name: "GlossarySessionLink_glossaryEntryId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type GlossarySessionLink = typeof glossarySessionLink.$inferSelect

export const artifact = sqliteTable("Artifact", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  ownerId: text("ownerId").notNull(),
  campaignId: text("campaignId"),
  provider: text("provider", { enum: ["LOCAL", "S3", "GDRIVE", "DB"] }).notNull(),
  storageKey: text("storageKey").notNull(),
  mimeType: text("mimeType").notNull(),
  byteSize: integer("byteSize").notNull(),
  checksumSha256: text("checksumSha256"),
  label: text("label"),
  meta: text("meta"),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
}, (table): SQLiteTableExtraConfigValue[] => [
  uniqueIndex("Artifact_provider_storageKey_key").on(table.provider, table.storageKey),
  index("Artifact_campaignId_idx").on(table.campaignId),
  index("Artifact_ownerId_idx").on(table.ownerId),
])
export type Artifact = typeof artifact.$inferSelect

export const recording = sqliteTable("Recording", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  sessionId: text("sessionId").notNull(),
  kind: text("kind", { enum: ["AUDIO", "VIDEO"] }).notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mimeType").notNull(),
  byteSize: integer("byteSize").notNull(),
  durationSeconds: integer("durationSeconds"),
  artifactId: text("artifactId").notNull(),
  vttArtifactId: text("vttArtifactId"),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
  updatedAt: dateTime("updatedAt").notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table): SQLiteTableExtraConfigValue[] => [
  index("Recording_vttArtifactId_idx").on(table.vttArtifactId),
  index("Recording_artifactId_idx").on(table.artifactId),
  index("Recording_sessionId_idx").on(table.sessionId),
  foreignKey({ columns: [table.vttArtifactId], foreignColumns: [artifact.id], name: "Recording_vttArtifactId_fkey" }).onUpdate("cascade").onDelete("set null"),
  foreignKey({ columns: [table.artifactId], foreignColumns: [artifact.id], name: "Recording_artifactId_fkey" }).onUpdate("cascade").onDelete("restrict"),
  foreignKey({ columns: [table.sessionId], foreignColumns: [session.id], name: "Recording_sessionId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type Recording = typeof recording.$inferSelect

export const transcriptionJob = sqliteTable("TranscriptionJob", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  recordingId: text("recordingId").notNull(),
  provider: text("provider", { enum: ["ELEVENLABS"] }).notNull(),
  status: text("status", { enum: ["SENDING", "SENT", "PROCESSING", "COMPLETED", "FAILED"] }).notNull(),
  requestId: text("requestId"),
  externalJobId: text("externalJobId"),
  modelId: text("modelId"),
  languageCode: text("languageCode"),
  numSpeakers: integer("numSpeakers"),
  diarize: booleanColumn("diarize").notNull().default(true),
  tagAudioEvents: booleanColumn("tagAudioEvents").notNull().default(false),
  requestedFormats: text("requestedFormats"),
  keyterms: text("keyterms"),
  errorMessage: text("errorMessage"),
  completedAt: dateTime("completedAt"),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
  updatedAt: dateTime("updatedAt").notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table): SQLiteTableExtraConfigValue[] => [
  index("TranscriptionJob_status_idx").on(table.status),
  index("TranscriptionJob_recordingId_idx").on(table.recordingId),
  uniqueIndex("TranscriptionJob_externalJobId_key").on(table.externalJobId),
  foreignKey({ columns: [table.recordingId], foreignColumns: [recording.id], name: "TranscriptionJob_recordingId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type TranscriptionJob = typeof transcriptionJob.$inferSelect

export const transcriptionArtifact = sqliteTable("TranscriptionArtifact", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  transcriptionJobId: text("transcriptionJobId").notNull(),
  artifactId: text("artifactId").notNull(),
  format: text("format", { enum: ["TXT", "SRT", "DOCX", "PDF", "HTML", "SEGMENTED_JSON"] }).notNull(),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
}, (table): SQLiteTableExtraConfigValue[] => [
  uniqueIndex("TranscriptionArtifact_transcriptionJobId_format_key").on(table.transcriptionJobId, table.format),
  index("TranscriptionArtifact_artifactId_idx").on(table.artifactId),
  foreignKey({ columns: [table.artifactId], foreignColumns: [artifact.id], name: "TranscriptionArtifact_artifactId_fkey" }).onUpdate("cascade").onDelete("cascade"),
  foreignKey({ columns: [table.transcriptionJobId], foreignColumns: [transcriptionJob.id], name: "TranscriptionArtifact_transcriptionJobId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type TranscriptionArtifact = typeof transcriptionArtifact.$inferSelect

export const recapRecording = sqliteTable("RecapRecording", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  sessionId: text("sessionId").notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mimeType").notNull(),
  byteSize: integer("byteSize").notNull(),
  durationSeconds: integer("durationSeconds"),
  artifactId: text("artifactId").notNull(),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
  updatedAt: dateTime("updatedAt").notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
  kind: text("kind", { enum: ["AUDIO", "VIDEO"] }).notNull().default("AUDIO"),
}, (table): SQLiteTableExtraConfigValue[] => [
  uniqueIndex("RecapRecording_sessionId_kind_key").on(table.sessionId, table.kind),
  index("RecapRecording_artifactId_idx").on(table.artifactId),
  foreignKey({ columns: [table.artifactId], foreignColumns: [artifact.id], name: "RecapRecording_artifactId_fkey" }).onUpdate("cascade").onDelete("restrict"),
  foreignKey({ columns: [table.sessionId], foreignColumns: [session.id], name: "RecapRecording_sessionId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type RecapRecording = typeof recapRecording.$inferSelect

export const quest = sqliteTable("Quest", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  campaignId: text("campaignId").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type", { enum: ["CAMPAIGN", "GUILD", "CHARACTER"] }).notNull().default("CAMPAIGN"),
  track: text("track", { enum: ["MAIN", "SIDE"] }).notNull().default("SIDE"),
  sourceType: text("sourceType", { enum: ["FREE_TEXT", "NPC", "CAMPAIGN_CHARACTER"] }).notNull().default("FREE_TEXT"),
  sourceText: text("sourceText"),
  sourceNpcId: text("sourceNpcId"),
  sourceCharacterId: text("sourceCharacterId"),
  reward: text("reward"),
  status: text("status", { enum: ["ACTIVE", "COMPLETED", "FAILED", "ON_HOLD"] }).notNull().default("ACTIVE"),
  progressNotes: text("progressNotes"),
  expirationYear: integer("expirationYear"),
  expirationMonth: integer("expirationMonth"),
  expirationDay: integer("expirationDay"),
  sortOrder: integer("sortOrder").notNull().default(0),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
  updatedAt: dateTime("updatedAt").notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table): SQLiteTableExtraConfigValue[] => [
  index("Quest_sourceCharacterId_idx").on(table.sourceCharacterId),
  index("Quest_sourceNpcId_idx").on(table.sourceNpcId),
  index("Quest_campaignId_idx").on(table.campaignId),
  foreignKey({ columns: [table.sourceCharacterId], foreignColumns: [playerCharacter.id], name: "Quest_sourceCharacterId_fkey" }).onUpdate("cascade").onDelete("set null"),
  foreignKey({ columns: [table.sourceNpcId], foreignColumns: [glossaryEntry.id], name: "Quest_sourceNpcId_fkey" }).onUpdate("cascade").onDelete("set null"),
  foreignKey({ columns: [table.campaignId], foreignColumns: [campaign.id], name: "Quest_campaignId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type Quest = typeof quest.$inferSelect

export const milestone = sqliteTable("Milestone", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  campaignId: text("campaignId").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  isComplete: booleanColumn("isComplete").notNull().default(false),
  completedAt: dateTime("completedAt"),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
  updatedAt: dateTime("updatedAt").notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table): SQLiteTableExtraConfigValue[] => [
  index("Milestone_campaignId_idx").on(table.campaignId),
  foreignKey({ columns: [table.campaignId], foreignColumns: [campaign.id], name: "Milestone_campaignId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type Milestone = typeof milestone.$inferSelect

export const document = sqliteTable("Document", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  campaignId: text("campaignId").notNull(),
  sessionId: text("sessionId"),
  recordingId: text("recordingId"),
  type: text("type", { enum: ["TRANSCRIPT", "SUMMARY", "NOTES"] }).notNull(),
  title: text("title").notNull(),
  currentVersionId: text("currentVersionId"),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
  updatedAt: dateTime("updatedAt").notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table): SQLiteTableExtraConfigValue[] => [
  uniqueIndex("Document_sessionId_type_key").on(table.sessionId, table.type),
  index("Document_recordingId_idx").on(table.recordingId),
  index("Document_sessionId_idx").on(table.sessionId),
  index("Document_campaignId_idx").on(table.campaignId),
  uniqueIndex("Document_currentVersionId_key").on(table.currentVersionId),
  foreignKey({ columns: [table.currentVersionId], foreignColumns: [documentVersion.id], name: "Document_currentVersionId_fkey" }).onUpdate("cascade").onDelete("set null"),
  foreignKey({ columns: [table.recordingId], foreignColumns: [recording.id], name: "Document_recordingId_fkey" }).onUpdate("cascade").onDelete("set null"),
  foreignKey({ columns: [table.sessionId], foreignColumns: [session.id], name: "Document_sessionId_fkey" }).onUpdate("cascade").onDelete("set null"),
  foreignKey({ columns: [table.campaignId], foreignColumns: [campaign.id], name: "Document_campaignId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type Document = typeof document.$inferSelect

export const documentVersion = sqliteTable("DocumentVersion", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  documentId: text("documentId").notNull(),
  versionNumber: integer("versionNumber").notNull(),
  content: text("content").notNull(),
  format: text("format", { enum: ["MARKDOWN", "PLAINTEXT"] }).notNull().default("MARKDOWN"),
  source: text("source", { enum: ["USER_EDIT", "USER_IMPORT", "SYSTEM_AUTOSAVE", "ELEVENLABS_IMPORT", "N8N_IMPORT"] }).notNull().default("USER_EDIT"),
  createdByUserId: text("createdByUserId"),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
}, (table): SQLiteTableExtraConfigValue[] => [
  uniqueIndex("DocumentVersion_documentId_versionNumber_key").on(table.documentId, table.versionNumber),
  index("DocumentVersion_createdByUserId_idx").on(table.createdByUserId),
  foreignKey({ columns: [table.createdByUserId], foreignColumns: [user.id], name: "DocumentVersion_createdByUserId_fkey" }).onUpdate("cascade").onDelete("set null"),
  foreignKey({ columns: [table.documentId], foreignColumns: [document.id], name: "DocumentVersion_documentId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type DocumentVersion = typeof documentVersion.$inferSelect

export const summaryJob = sqliteTable("SummaryJob", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  campaignId: text("campaignId").notNull(),
  sessionId: text("sessionId").notNull(),
  documentId: text("documentId").notNull(),
  summaryDocumentId: text("summaryDocumentId"),
  trackingId: text("trackingId").notNull(),
  status: text("status", { enum: ["QUEUED", "SENT", "PROCESSING", "READY_FOR_REVIEW", "APPLIED", "FAILED"] }).notNull(),
  mode: text("mode", { enum: ["SYNC", "ASYNC"] }).notNull(),
  promptProfile: text("promptProfile"),
  webhookUrl: text("webhookUrl"),
  requestHash: text("requestHash"),
  responseHash: text("responseHash"),
  errorMessage: text("errorMessage"),
  meta: jsonColumn("meta"),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
  updatedAt: dateTime("updatedAt").notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
  kind: text("kind", { enum: ["SUMMARY_GENERATION", "SUGGESTION_GENERATION"] }).notNull().default("SUMMARY_GENERATION"),
}, (table): SQLiteTableExtraConfigValue[] => [
  index("SummaryJob_sessionId_kind_createdAt_idx").on(table.sessionId, table.kind, table.createdAt),
  index("SummaryJob_kind_idx").on(table.kind),
  index("SummaryJob_status_idx").on(table.status),
  index("SummaryJob_documentId_idx").on(table.documentId),
  index("SummaryJob_sessionId_idx").on(table.sessionId),
  index("SummaryJob_campaignId_idx").on(table.campaignId),
  uniqueIndex("SummaryJob_trackingId_key").on(table.trackingId),
  foreignKey({ columns: [table.summaryDocumentId], foreignColumns: [document.id], name: "SummaryJob_summaryDocumentId_fkey" }).onUpdate("cascade").onDelete("set null"),
  foreignKey({ columns: [table.documentId], foreignColumns: [document.id], name: "SummaryJob_documentId_fkey" }).onUpdate("cascade").onDelete("cascade"),
  foreignKey({ columns: [table.sessionId], foreignColumns: [session.id], name: "SummaryJob_sessionId_fkey" }).onUpdate("cascade").onDelete("cascade"),
  foreignKey({ columns: [table.campaignId], foreignColumns: [campaign.id], name: "SummaryJob_campaignId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type SummaryJob = typeof summaryJob.$inferSelect

export const summarySuggestion = sqliteTable("SummarySuggestion", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  summaryJobId: text("summaryJobId").notNull(),
  entityType: text("entityType", { enum: ["SESSION", "QUEST", "MILESTONE", "GLOSSARY", "PC", "NPC", "ITEM", "LOCATION"] }).notNull(),
  action: text("action", { enum: ["CREATE", "UPDATE", "DISCARD"] }).notNull(),
  status: text("status", { enum: ["PENDING", "APPLIED", "DISCARDED"] }).notNull().default("PENDING"),
  match: jsonColumn("match"),
  payload: jsonColumn("payload").notNull(),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
  updatedAt: dateTime("updatedAt").notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table): SQLiteTableExtraConfigValue[] => [
  index("SummarySuggestion_status_idx").on(table.status),
  index("SummarySuggestion_summaryJobId_idx").on(table.summaryJobId),
  foreignKey({ columns: [table.summaryJobId], foreignColumns: [summaryJob.id], name: "SummarySuggestion_summaryJobId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type SummarySuggestion = typeof summarySuggestion.$inferSelect

export const playerCharacter = sqliteTable("PlayerCharacter", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  ownerId: text("ownerId").notNull(),
  name: text("name").notNull(),
  status: text("status"),
  portraitUrl: text("portraitUrl"),
  portraitArtifactId: text("portraitArtifactId"),
  sheetJson: jsonColumn("sheetJson").notNull(),
  summaryJson: jsonColumn("summaryJson").notNull(),
  sourceProvider: text("sourceProvider", { enum: ["MANUAL", "DND_BEYOND"] }).notNull().default("MANUAL"),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
  updatedAt: dateTime("updatedAt").notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table): SQLiteTableExtraConfigValue[] => [
  index("PlayerCharacter_name_idx").on(table.name),
  index("PlayerCharacter_ownerId_idx").on(table.ownerId),
  foreignKey({ columns: [table.portraitArtifactId], foreignColumns: [artifact.id], name: "PlayerCharacter_portraitArtifactId_fkey" }).onUpdate("cascade").onDelete("set null"),
  foreignKey({ columns: [table.ownerId], foreignColumns: [user.id], name: "PlayerCharacter_ownerId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type PlayerCharacter = typeof playerCharacter.$inferSelect

export const campaignCharacter = sqliteTable("CampaignCharacter", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  campaignId: text("campaignId").notNull(),
  characterId: text("characterId").notNull(),
  glossaryEntryId: text("glossaryEntryId"),
  status: text("status", { enum: ["ACTIVE", "INACTIVE"] }).notNull().default("ACTIVE"),
  roleLabel: text("roleLabel"),
  notes: text("notes"),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
  updatedAt: dateTime("updatedAt").notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table): SQLiteTableExtraConfigValue[] => [
  uniqueIndex("CampaignCharacter_campaignId_characterId_key").on(table.campaignId, table.characterId),
  index("CampaignCharacter_glossaryEntryId_idx").on(table.glossaryEntryId),
  index("CampaignCharacter_characterId_idx").on(table.characterId),
  index("CampaignCharacter_campaignId_status_idx").on(table.campaignId, table.status),
  foreignKey({ columns: [table.glossaryEntryId], foreignColumns: [glossaryEntry.id], name: "CampaignCharacter_glossaryEntryId_fkey" }).onUpdate("cascade").onDelete("set null"),
  foreignKey({ columns: [table.characterId], foreignColumns: [playerCharacter.id], name: "CampaignCharacter_characterId_fkey" }).onUpdate("cascade").onDelete("cascade"),
  foreignKey({ columns: [table.campaignId], foreignColumns: [campaign.id], name: "CampaignCharacter_campaignId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type CampaignCharacter = typeof campaignCharacter.$inferSelect

export const characterImport = sqliteTable("CharacterImport", {
  id: text("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  characterId: text("characterId").notNull(),
  provider: text("provider", { enum: ["MANUAL", "DND_BEYOND"] }).notNull(),
  externalId: text("externalId"),
  sourceUrl: text("sourceUrl"),
  rawJson: jsonColumn("rawJson").notNull(),
  rawHash: text("rawHash").notNull(),
  importedAt: dateTime("importedAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
  lastSyncedAt: dateTime("lastSyncedAt"),
  lastSyncStatus: text("lastSyncStatus"),
  lastSyncMessage: text("lastSyncMessage"),
}, (table): SQLiteTableExtraConfigValue[] => [
  index("CharacterImport_provider_externalId_idx").on(table.provider, table.externalId),
  index("CharacterImport_characterId_idx").on(table.characterId),
  foreignKey({ columns: [table.characterId], foreignColumns: [playerCharacter.id], name: "CharacterImport_characterId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type CharacterImport = typeof characterImport.$inferSelect

export const characterImportSettings = sqliteTable("CharacterImportSettings", {
  characterId: text("characterId").primaryKey().notNull(),
  lockedSections: jsonColumn("lockedSections"),
  defaultOverwriteMode: text("defaultOverwriteMode", { enum: ["FULL", "SECTIONS"] }).notNull().default("SECTIONS"),
  createdAt: dateTime("createdAt").notNull().default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`),
  updatedAt: dateTime("updatedAt").notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table): SQLiteTableExtraConfigValue[] => [
  foreignKey({ columns: [table.characterId], foreignColumns: [playerCharacter.id], name: "CharacterImportSettings_characterId_fkey" }).onUpdate("cascade").onDelete("cascade"),
])
export type CharacterImportSettings = typeof characterImportSettings.$inferSelect

export const userRelations = relations(user, ({ many }) => ({
  campaigns: many(campaign, { relationName: "Campaign_owner" }),
  campaignMemberships: many(campaignMember, { relationName: "CampaignMember_user" }),
  campaignMembershipInvitesSent: many(campaignMember, { relationName: "CampaignMember_invitedByUser" }),
  campaignInvitesSent: many(campaignInvite, { relationName: "CampaignInvite_invitedByUser" }),
  campaignInvitesAccepted: many(campaignInvite, { relationName: "CampaignInvite_acceptedByUser" }),
  campaignPublicAccessUpdates: many(campaignPublicAccess, { relationName: "CampaignPublicAccess_updatedByUser" }),
  activityActions: many(activityLog, { relationName: "ActivityLog_actorUser" }),
  documentVersions: many(documentVersion, { relationName: "DocumentVersion_createdByUser" }),
  playerCharacters: many(playerCharacter, { relationName: "PlayerCharacter_owner" }),
  adminAuditActions: many(adminAuditLog, { relationName: "AdminAuditLog_actorUser" }),
  calendarEventsCreated: many(campaignCalendarEvent, { relationName: "CampaignCalendarEvent_createdByUser" }),
  encountersCreated: many(campaignEncounter, { relationName: "CampaignEncounter_createdByUser" }),
  encounterEventsCreated: many(encounterEvent, { relationName: "EncounterEvent_createdByUser" }),
  encounterTemplatesCreated: many(encounterTemplate, { relationName: "EncounterTemplate_createdByUser" }),
  encounterStatBlocksCreated: many(encounterStatBlock, { relationName: "EncounterStatBlock_createdByUser" }),
  dungeonsCreated: many(campaignDungeon, { relationName: "CampaignDungeon_createdByUser" }),
  dungeonSnapshotsCreated: many(campaignDungeonSnapshot, { relationName: "CampaignDungeonSnapshot_createdByUser" }),
  campaignRequestsCreated: many(campaignRequest, { relationName: "CampaignRequest_createdByUser" }),
  campaignRequestsDecided: many(campaignRequest, { relationName: "CampaignRequest_decidedByUser" }),
  campaignRequestVotes: many(campaignRequestVote, { relationName: "CampaignRequestVote_user" }),
  journalEntriesAuthored: many(campaignJournalEntry, { relationName: "CampaignJournalEntry_authorUser" }),
  journalEntriesHeld: many(campaignJournalEntry, { relationName: "CampaignJournalEntry_holderUser" }),
  journalEntriesDiscovered: many(campaignJournalEntry, { relationName: "CampaignJournalEntry_discoveredByUser" }),
  journalEntriesArchived: many(campaignJournalEntry, { relationName: "CampaignJournalEntry_archivedByUser" }),
  journalEntryTransferActions: many(campaignJournalEntryTransferHistory, { relationName: "CampaignJournalEntryTransferHistory_actorUser" }),
  journalEntryTransferFrom: many(campaignJournalEntryTransferHistory, { relationName: "CampaignJournalEntryTransferHistory_fromHolderUser" }),
  journalEntryTransferTo: many(campaignJournalEntryTransferHistory, { relationName: "CampaignJournalEntryTransferHistory_toHolderUser" }),
  apiKeys: many(apiKey, { relationName: "ApiKey_user" }),
}))

export const activityLogRelations = relations(activityLog, ({ one }) => ({
  actorUser: one(user, { relationName: "ActivityLog_actorUser", fields: [activityLog.actorUserId], references: [user.id] }),
  campaign: one(campaign, { relationName: "ActivityLog_campaign", fields: [activityLog.campaignId], references: [campaign.id] }),
}))

export const adminAuditLogRelations = relations(adminAuditLog, ({ one }) => ({
  actorUser: one(user, { relationName: "AdminAuditLog_actorUser", fields: [adminAuditLog.actorUserId], references: [user.id] }),
}))

// Inverse one-to-one rows are optional even when the source primary key is required.
// Stable Drizzle requires explicit fields for named inverse relations; retain their nullable result types.
export const campaignRelations = relations(campaign, ({ one, many }) => ({
  owner: one(user, { relationName: "Campaign_owner", fields: [campaign.ownerId], references: [user.id] }),
  sessions: many(session, { relationName: "Session_campaign" }),
  glossary: many(glossaryEntry, { relationName: "GlossaryEntry_campaign" }),
  quests: many(quest, { relationName: "Quest_campaign" }),
  milestones: many(milestone, { relationName: "Milestone_campaign" }),
  documents: many(document, { relationName: "Document_campaign" }),
  characters: many(campaignCharacter, { relationName: "CampaignCharacter_campaign" }),
  summaryJobs: many(summaryJob, { relationName: "SummaryJob_campaign" }),
  maps: many(campaignMap, { relationName: "CampaignMap_campaign" }),
  members: many(campaignMember, { relationName: "CampaignMember_campaign" }),
  invites: many(campaignInvite, { relationName: "CampaignInvite_campaign" }),
  publicAccess: one(campaignPublicAccess, { fields: [campaign.id], references: [campaignPublicAccess.campaignId], relationName: "CampaignPublicAccess_campaign" }) as unknown as One<"CampaignPublicAccess", false>,
  activityLogs: many(activityLog, { relationName: "ActivityLog_campaign" }),
  calendarConfig: one(campaignCalendarConfig, { fields: [campaign.id], references: [campaignCalendarConfig.campaignId], relationName: "CampaignCalendarConfig_campaign" }) as unknown as One<"CampaignCalendarConfig", false>,
  calendarEvents: many(campaignCalendarEvent, { relationName: "CampaignCalendarEvent_campaign" }),
  sessionCalendarRanges: many(sessionCalendarRange, { relationName: "SessionCalendarRange_campaign" }),
  encounters: many(campaignEncounter, { relationName: "CampaignEncounter_campaign" }),
  encounterTemplates: many(encounterTemplate, { relationName: "EncounterTemplate_campaign" }),
  encounterStatBlocks: many(encounterStatBlock, { relationName: "EncounterStatBlock_campaign" }),
  dungeons: many(campaignDungeon, { relationName: "CampaignDungeon_campaign" }),
  requests: many(campaignRequest, { relationName: "CampaignRequest_campaign" }),
  requestVotes: many(campaignRequestVote, { relationName: "CampaignRequestVote_campaign" }),
  journalEntries: many(campaignJournalEntry, { relationName: "CampaignJournalEntry_campaign" }),
  journalTags: many(campaignJournalTag, { relationName: "CampaignJournalTag_campaign" }),
  journalEntrySessionLinks: many(campaignJournalEntrySessionLink, { relationName: "CampaignJournalEntrySessionLink_campaign" }),
  journalEntryTransfers: many(campaignJournalEntryTransferHistory, { relationName: "CampaignJournalEntryTransferHistory_campaign" }),
  apiKeyCampaigns: many(apiKeyCampaign, { relationName: "ApiKeyCampaign_campaign" }),
}))

export const apiKeyRelations = relations(apiKey, ({ one, many }) => ({
  user: one(user, { relationName: "ApiKey_user", fields: [apiKey.userId], references: [user.id] }),
  campaigns: many(apiKeyCampaign, { relationName: "ApiKeyCampaign_apiKey" }),
}))

export const apiKeyCampaignRelations = relations(apiKeyCampaign, ({ one }) => ({
  apiKey: one(apiKey, { relationName: "ApiKeyCampaign_apiKey", fields: [apiKeyCampaign.apiKeyId], references: [apiKey.id] }),
  campaign: one(campaign, { relationName: "ApiKeyCampaign_campaign", fields: [apiKeyCampaign.campaignId], references: [campaign.id] }),
}))

export const campaignPublicAccessRelations = relations(campaignPublicAccess, ({ one }) => ({
  campaign: one(campaign, { relationName: "CampaignPublicAccess_campaign", fields: [campaignPublicAccess.campaignId], references: [campaign.id] }),
  updatedByUser: one(user, { relationName: "CampaignPublicAccess_updatedByUser", fields: [campaignPublicAccess.updatedByUserId], references: [user.id] }),
}))

export const campaignMemberRelations = relations(campaignMember, ({ one }) => ({
  campaign: one(campaign, { relationName: "CampaignMember_campaign", fields: [campaignMember.campaignId], references: [campaign.id] }),
  user: one(user, { relationName: "CampaignMember_user", fields: [campaignMember.userId], references: [user.id] }),
  invitedByUser: one(user, { relationName: "CampaignMember_invitedByUser", fields: [campaignMember.invitedByUserId], references: [user.id] }),
}))

export const campaignInviteRelations = relations(campaignInvite, ({ one }) => ({
  campaign: one(campaign, { relationName: "CampaignInvite_campaign", fields: [campaignInvite.campaignId], references: [campaign.id] }),
  invitedByUser: one(user, { relationName: "CampaignInvite_invitedByUser", fields: [campaignInvite.invitedByUserId], references: [user.id] }),
  acceptedByUser: one(user, { relationName: "CampaignInvite_acceptedByUser", fields: [campaignInvite.acceptedByUserId], references: [user.id] }),
}))

export const campaignRequestRelations = relations(campaignRequest, ({ one, many }) => ({
  campaign: one(campaign, { relationName: "CampaignRequest_campaign", fields: [campaignRequest.campaignId], references: [campaign.id] }),
  createdByUser: one(user, { relationName: "CampaignRequest_createdByUser", fields: [campaignRequest.createdByUserId], references: [user.id] }),
  decidedByUser: one(user, { relationName: "CampaignRequest_decidedByUser", fields: [campaignRequest.decidedByUserId], references: [user.id] }),
  votes: many(campaignRequestVote, { relationName: "CampaignRequestVote_campaignRequest" }),
}))

export const campaignRequestVoteRelations = relations(campaignRequestVote, ({ one }) => ({
  campaignRequest: one(campaignRequest, { relationName: "CampaignRequestVote_campaignRequest", fields: [campaignRequestVote.campaignRequestId], references: [campaignRequest.id] }),
  campaign: one(campaign, { relationName: "CampaignRequestVote_campaign", fields: [campaignRequestVote.campaignId], references: [campaign.id] }),
  user: one(user, { relationName: "CampaignRequestVote_user", fields: [campaignRequestVote.userId], references: [user.id] }),
}))

export const campaignJournalEntryRelations = relations(campaignJournalEntry, ({ one, many }) => ({
  campaign: one(campaign, { relationName: "CampaignJournalEntry_campaign", fields: [campaignJournalEntry.campaignId], references: [campaign.id] }),
  authorUser: one(user, { relationName: "CampaignJournalEntry_authorUser", fields: [campaignJournalEntry.authorUserId], references: [user.id] }),
  holderUser: one(user, { relationName: "CampaignJournalEntry_holderUser", fields: [campaignJournalEntry.holderUserId], references: [user.id] }),
  discoveredByUser: one(user, { relationName: "CampaignJournalEntry_discoveredByUser", fields: [campaignJournalEntry.discoveredByUserId], references: [user.id] }),
  archivedByUser: one(user, { relationName: "CampaignJournalEntry_archivedByUser", fields: [campaignJournalEntry.archivedByUserId], references: [user.id] }),
  tags: many(campaignJournalTag, { relationName: "CampaignJournalTag_entry" }),
  sessionLinks: many(campaignJournalEntrySessionLink, { relationName: "CampaignJournalEntrySessionLink_entry" }),
  transferHistory: many(campaignJournalEntryTransferHistory, { relationName: "CampaignJournalEntryTransferHistory_entry" }),
}))

export const campaignJournalTagRelations = relations(campaignJournalTag, ({ one }) => ({
  entry: one(campaignJournalEntry, { relationName: "CampaignJournalTag_entry", fields: [campaignJournalTag.campaignJournalEntryId], references: [campaignJournalEntry.id] }),
  campaign: one(campaign, { relationName: "CampaignJournalTag_campaign", fields: [campaignJournalTag.campaignId], references: [campaign.id] }),
  glossaryEntry: one(glossaryEntry, { relationName: "CampaignJournalTag_glossaryEntry", fields: [campaignJournalTag.glossaryEntryId], references: [glossaryEntry.id] }),
}))

export const campaignJournalEntrySessionLinkRelations = relations(campaignJournalEntrySessionLink, ({ one }) => ({
  entry: one(campaignJournalEntry, { relationName: "CampaignJournalEntrySessionLink_entry", fields: [campaignJournalEntrySessionLink.campaignJournalEntryId], references: [campaignJournalEntry.id] }),
  session: one(session, { relationName: "CampaignJournalEntrySessionLink_session", fields: [campaignJournalEntrySessionLink.sessionId, campaignJournalEntrySessionLink.campaignId], references: [session.id, session.campaignId] }),
  campaign: one(campaign, { relationName: "CampaignJournalEntrySessionLink_campaign", fields: [campaignJournalEntrySessionLink.campaignId], references: [campaign.id] }),
}))

export const campaignJournalEntryTransferHistoryRelations = relations(campaignJournalEntryTransferHistory, ({ one }) => ({
  entry: one(campaignJournalEntry, { relationName: "CampaignJournalEntryTransferHistory_entry", fields: [campaignJournalEntryTransferHistory.campaignJournalEntryId], references: [campaignJournalEntry.id] }),
  campaign: one(campaign, { relationName: "CampaignJournalEntryTransferHistory_campaign", fields: [campaignJournalEntryTransferHistory.campaignId], references: [campaign.id] }),
  fromHolderUser: one(user, { relationName: "CampaignJournalEntryTransferHistory_fromHolderUser", fields: [campaignJournalEntryTransferHistory.fromHolderUserId], references: [user.id] }),
  toHolderUser: one(user, { relationName: "CampaignJournalEntryTransferHistory_toHolderUser", fields: [campaignJournalEntryTransferHistory.toHolderUserId], references: [user.id] }),
  actorUser: one(user, { relationName: "CampaignJournalEntryTransferHistory_actorUser", fields: [campaignJournalEntryTransferHistory.actorUserId], references: [user.id] }),
}))

export const sessionRelations = relations(session, ({ one, many }) => ({
  campaign: one(campaign, { relationName: "Session_campaign", fields: [session.campaignId], references: [campaign.id] }),
  glossaryLinks: many(glossarySessionLink, { relationName: "GlossarySessionLink_session" }),
  recordings: many(recording, { relationName: "Recording_session" }),
  documents: many(document, { relationName: "Document_session" }),
  recaps: many(recapRecording, { relationName: "RecapRecording_session" }),
  summaryJobs: many(summaryJob, { relationName: "SummaryJob_session" }),
  calendarRange: one(sessionCalendarRange, { fields: [session.id, session.campaignId], references: [sessionCalendarRange.sessionId, sessionCalendarRange.campaignId], relationName: "SessionCalendarRange_session" }) as unknown as One<"SessionCalendarRange", false>,
  encounters: many(campaignEncounter, { relationName: "CampaignEncounter_session" }),
  journalEntryLinks: many(campaignJournalEntrySessionLink, { relationName: "CampaignJournalEntrySessionLink_session" }),
}))

export const campaignCalendarConfigRelations = relations(campaignCalendarConfig, ({ one }) => ({
  campaign: one(campaign, { relationName: "CampaignCalendarConfig_campaign", fields: [campaignCalendarConfig.campaignId], references: [campaign.id] }),
}))

export const sessionCalendarRangeRelations = relations(sessionCalendarRange, ({ one }) => ({
  session: one(session, { relationName: "SessionCalendarRange_session", fields: [sessionCalendarRange.sessionId, sessionCalendarRange.campaignId], references: [session.id, session.campaignId] }),
  campaign: one(campaign, { relationName: "SessionCalendarRange_campaign", fields: [sessionCalendarRange.campaignId], references: [campaign.id] }),
}))

export const campaignCalendarEventRelations = relations(campaignCalendarEvent, ({ one }) => ({
  campaign: one(campaign, { relationName: "CampaignCalendarEvent_campaign", fields: [campaignCalendarEvent.campaignId], references: [campaign.id] }),
  createdByUser: one(user, { relationName: "CampaignCalendarEvent_createdByUser", fields: [campaignCalendarEvent.createdByUserId], references: [user.id] }),
}))

export const campaignEncounterRelations = relations(campaignEncounter, ({ one, many }) => ({
  campaign: one(campaign, { relationName: "CampaignEncounter_campaign", fields: [campaignEncounter.campaignId], references: [campaign.id] }),
  session: one(session, { relationName: "CampaignEncounter_session", fields: [campaignEncounter.sessionId], references: [session.id] }),
  createdByUser: one(user, { relationName: "CampaignEncounter_createdByUser", fields: [campaignEncounter.createdByUserId], references: [user.id] }),
  combatants: many(encounterCombatant, { relationName: "EncounterCombatant_encounter" }),
  events: many(encounterEvent, { relationName: "EncounterEvent_encounter" }),
}))

export const encounterCombatantRelations = relations(encounterCombatant, ({ one, many }) => ({
  encounter: one(campaignEncounter, { relationName: "EncounterCombatant_encounter", fields: [encounterCombatant.encounterId], references: [campaignEncounter.id] }),
  conditions: many(encounterCondition, { relationName: "EncounterCondition_combatant" }),
}))

export const encounterConditionRelations = relations(encounterCondition, ({ one }) => ({
  combatant: one(encounterCombatant, { relationName: "EncounterCondition_combatant", fields: [encounterCondition.combatantId], references: [encounterCombatant.id] }),
}))

export const encounterEventRelations = relations(encounterEvent, ({ one }) => ({
  encounter: one(campaignEncounter, { relationName: "EncounterEvent_encounter", fields: [encounterEvent.encounterId], references: [campaignEncounter.id] }),
  createdByUser: one(user, { relationName: "EncounterEvent_createdByUser", fields: [encounterEvent.createdByUserId], references: [user.id] }),
}))

export const encounterTemplateRelations = relations(encounterTemplate, ({ one, many }) => ({
  campaign: one(campaign, { relationName: "EncounterTemplate_campaign", fields: [encounterTemplate.campaignId], references: [campaign.id] }),
  createdByUser: one(user, { relationName: "EncounterTemplate_createdByUser", fields: [encounterTemplate.createdByUserId], references: [user.id] }),
  combatants: many(encounterTemplateCombatant, { relationName: "EncounterTemplateCombatant_template" }),
}))

export const encounterTemplateCombatantRelations = relations(encounterTemplateCombatant, ({ one }) => ({
  template: one(encounterTemplate, { relationName: "EncounterTemplateCombatant_template", fields: [encounterTemplateCombatant.templateId], references: [encounterTemplate.id] }),
}))

export const encounterStatBlockRelations = relations(encounterStatBlock, ({ one }) => ({
  campaign: one(campaign, { relationName: "EncounterStatBlock_campaign", fields: [encounterStatBlock.campaignId], references: [campaign.id] }),
  createdByUser: one(user, { relationName: "EncounterStatBlock_createdByUser", fields: [encounterStatBlock.createdByUserId], references: [user.id] }),
}))

export const campaignDungeonRelations = relations(campaignDungeon, ({ one, many }) => ({
  campaign: one(campaign, { relationName: "CampaignDungeon_campaign", fields: [campaignDungeon.campaignId], references: [campaign.id] }),
  createdByUser: one(user, { relationName: "CampaignDungeon_createdByUser", fields: [campaignDungeon.createdByUserId], references: [user.id] }),
  rooms: many(campaignDungeonRoom, { relationName: "CampaignDungeonRoom_dungeon" }),
  links: many(campaignDungeonLink, { relationName: "CampaignDungeonLink_dungeon" }),
  snapshots: many(campaignDungeonSnapshot, { relationName: "CampaignDungeonSnapshot_dungeon" }),
}))

export const campaignDungeonRoomRelations = relations(campaignDungeonRoom, ({ one, many }) => ({
  dungeon: one(campaignDungeon, { relationName: "CampaignDungeonRoom_dungeon", fields: [campaignDungeonRoom.dungeonId], references: [campaignDungeon.id] }),
  links: many(campaignDungeonLink, { relationName: "CampaignDungeonLink_room" }),
}))

export const campaignDungeonLinkRelations = relations(campaignDungeonLink, ({ one }) => ({
  dungeon: one(campaignDungeon, { relationName: "CampaignDungeonLink_dungeon", fields: [campaignDungeonLink.dungeonId], references: [campaignDungeon.id] }),
  room: one(campaignDungeonRoom, { relationName: "CampaignDungeonLink_room", fields: [campaignDungeonLink.roomId], references: [campaignDungeonRoom.id] }),
}))

export const campaignDungeonSnapshotRelations = relations(campaignDungeonSnapshot, ({ one }) => ({
  dungeon: one(campaignDungeon, { relationName: "CampaignDungeonSnapshot_dungeon", fields: [campaignDungeonSnapshot.dungeonId], references: [campaignDungeon.id] }),
  createdByUser: one(user, { relationName: "CampaignDungeonSnapshot_createdByUser", fields: [campaignDungeonSnapshot.createdByUserId], references: [user.id] }),
}))

export const glossaryEntryRelations = relations(glossaryEntry, ({ one, many }) => ({
  campaign: one(campaign, { relationName: "GlossaryEntry_campaign", fields: [glossaryEntry.campaignId], references: [campaign.id] }),
  sessions: many(glossarySessionLink, { relationName: "GlossarySessionLink_glossaryEntry" }),
  campaignCharacters: many(campaignCharacter, { relationName: "CampaignCharacter_glossaryEntry" }),
  sourceMap: one(campaignMap, { relationName: "GlossaryEntry_sourceMap", fields: [glossaryEntry.sourceMapId], references: [campaignMap.id] }),
  sourceMapFeature: one(campaignMapFeature, { relationName: "GlossaryEntry_sourceMapFeature", fields: [glossaryEntry.sourceMapFeatureId], references: [campaignMapFeature.id] }),
  mapLinks: many(campaignMapGlossaryLink, { relationName: "CampaignMapGlossaryLink_glossaryEntry" }),
  journalTags: many(campaignJournalTag, { relationName: "CampaignJournalTag_glossaryEntry" }),
  questSources: many(quest, { relationName: "Quest_sourceNpc" }),
}))

export const campaignMapRelations = relations(campaignMap, ({ one, many }) => ({
  campaign: one(campaign, { relationName: "CampaignMap_campaign", fields: [campaignMap.campaignId], references: [campaign.id] }),
  files: many(campaignMapFile, { relationName: "CampaignMapFile_campaignMap" }),
  features: many(campaignMapFeature, { relationName: "CampaignMapFeature_campaignMap" }),
  glossaryLinks: many(campaignMapGlossaryLink, { relationName: "CampaignMapGlossaryLink_campaignMap" }),
  sourceGlossaryEntries: many(glossaryEntry, { relationName: "GlossaryEntry_sourceMap" }),
}))

export const campaignMapFileRelations = relations(campaignMapFile, ({ one }) => ({
  campaignMap: one(campaignMap, { relationName: "CampaignMapFile_campaignMap", fields: [campaignMapFile.campaignMapId], references: [campaignMap.id] }),
}))

export const campaignMapFeatureRelations = relations(campaignMapFeature, ({ one, many }) => ({
  campaignMap: one(campaignMap, { relationName: "CampaignMapFeature_campaignMap", fields: [campaignMapFeature.campaignMapId], references: [campaignMap.id] }),
  glossaryLinks: many(campaignMapGlossaryLink, { relationName: "CampaignMapGlossaryLink_mapFeature" }),
  sourceGlossaryEntries: many(glossaryEntry, { relationName: "GlossaryEntry_sourceMapFeature" }),
}))

export const campaignMapGlossaryLinkRelations = relations(campaignMapGlossaryLink, ({ one }) => ({
  campaignMap: one(campaignMap, { relationName: "CampaignMapGlossaryLink_campaignMap", fields: [campaignMapGlossaryLink.campaignMapId], references: [campaignMap.id] }),
  mapFeature: one(campaignMapFeature, { relationName: "CampaignMapGlossaryLink_mapFeature", fields: [campaignMapGlossaryLink.mapFeatureId], references: [campaignMapFeature.id] }),
  glossaryEntry: one(glossaryEntry, { relationName: "CampaignMapGlossaryLink_glossaryEntry", fields: [campaignMapGlossaryLink.glossaryEntryId], references: [glossaryEntry.id] }),
}))

export const glossarySessionLinkRelations = relations(glossarySessionLink, ({ one }) => ({
  glossaryEntry: one(glossaryEntry, { relationName: "GlossarySessionLink_glossaryEntry", fields: [glossarySessionLink.glossaryEntryId], references: [glossaryEntry.id] }),
  session: one(session, { relationName: "GlossarySessionLink_session", fields: [glossarySessionLink.sessionId], references: [session.id] }),
}))

export const artifactRelations = relations(artifact, ({ many }) => ({
  recordings: many(recording, { relationName: "Recording_artifact" }),
  vttRecordings: many(recording, { relationName: "Recording_vttArtifact" }),
  recapRecordings: many(recapRecording, { relationName: "RecapRecording_artifact" }),
  transcriptionArtifacts: many(transcriptionArtifact, { relationName: "TranscriptionArtifact_artifact" }),
  characterPortraits: many(playerCharacter, { relationName: "PlayerCharacter_portraitArtifact" }),
}))

export const recordingRelations = relations(recording, ({ one, many }) => ({
  session: one(session, { relationName: "Recording_session", fields: [recording.sessionId], references: [session.id] }),
  artifact: one(artifact, { relationName: "Recording_artifact", fields: [recording.artifactId], references: [artifact.id] }),
  vttArtifact: one(artifact, { relationName: "Recording_vttArtifact", fields: [recording.vttArtifactId], references: [artifact.id] }),
  documents: many(document, { relationName: "Document_recording" }),
  transcriptionJobs: many(transcriptionJob, { relationName: "TranscriptionJob_recording" }),
}))

export const transcriptionJobRelations = relations(transcriptionJob, ({ one, many }) => ({
  recording: one(recording, { relationName: "TranscriptionJob_recording", fields: [transcriptionJob.recordingId], references: [recording.id] }),
  artifacts: many(transcriptionArtifact, { relationName: "TranscriptionArtifact_transcriptionJob" }),
}))

export const transcriptionArtifactRelations = relations(transcriptionArtifact, ({ one }) => ({
  transcriptionJob: one(transcriptionJob, { relationName: "TranscriptionArtifact_transcriptionJob", fields: [transcriptionArtifact.transcriptionJobId], references: [transcriptionJob.id] }),
  artifact: one(artifact, { relationName: "TranscriptionArtifact_artifact", fields: [transcriptionArtifact.artifactId], references: [artifact.id] }),
}))

export const recapRecordingRelations = relations(recapRecording, ({ one }) => ({
  session: one(session, { relationName: "RecapRecording_session", fields: [recapRecording.sessionId], references: [session.id] }),
  artifact: one(artifact, { relationName: "RecapRecording_artifact", fields: [recapRecording.artifactId], references: [artifact.id] }),
}))

export const questRelations = relations(quest, ({ one }) => ({
  campaign: one(campaign, { relationName: "Quest_campaign", fields: [quest.campaignId], references: [campaign.id] }),
  sourceNpc: one(glossaryEntry, { relationName: "Quest_sourceNpc", fields: [quest.sourceNpcId], references: [glossaryEntry.id] }),
  sourceCharacter: one(playerCharacter, { relationName: "Quest_sourceCharacter", fields: [quest.sourceCharacterId], references: [playerCharacter.id] }),
}))

export const milestoneRelations = relations(milestone, ({ one }) => ({
  campaign: one(campaign, { relationName: "Milestone_campaign", fields: [milestone.campaignId], references: [campaign.id] }),
}))

export const documentRelations = relations(document, ({ one, many }) => ({
  campaign: one(campaign, { relationName: "Document_campaign", fields: [document.campaignId], references: [campaign.id] }),
  session: one(session, { relationName: "Document_session", fields: [document.sessionId], references: [session.id] }),
  recording: one(recording, { relationName: "Document_recording", fields: [document.recordingId], references: [recording.id] }),
  currentVersion: one(documentVersion, { relationName: "Document_currentVersion", fields: [document.currentVersionId], references: [documentVersion.id] }),
  versions: many(documentVersion, { relationName: "DocumentVersion_document" }),
  summaryJobsAsTranscript: many(summaryJob, { relationName: "SummaryJob_document" }),
  summaryJobsAsSummary: many(summaryJob, { relationName: "SummaryJob_summaryDocument" }),
}))

export const documentVersionRelations = relations(documentVersion, ({ one }) => ({
  document: one(document, { relationName: "DocumentVersion_document", fields: [documentVersion.documentId], references: [document.id] }),
  currentForDocument: one(document, { fields: [documentVersion.id], references: [document.currentVersionId], relationName: "Document_currentVersion" }) as unknown as One<"Document", false>,
  createdByUser: one(user, { relationName: "DocumentVersion_createdByUser", fields: [documentVersion.createdByUserId], references: [user.id] }),
}))

export const summaryJobRelations = relations(summaryJob, ({ one, many }) => ({
  campaign: one(campaign, { relationName: "SummaryJob_campaign", fields: [summaryJob.campaignId], references: [campaign.id] }),
  session: one(session, { relationName: "SummaryJob_session", fields: [summaryJob.sessionId], references: [session.id] }),
  document: one(document, { relationName: "SummaryJob_document", fields: [summaryJob.documentId], references: [document.id] }),
  summaryDocument: one(document, { relationName: "SummaryJob_summaryDocument", fields: [summaryJob.summaryDocumentId], references: [document.id] }),
  suggestions: many(summarySuggestion, { relationName: "SummarySuggestion_summaryJob" }),
}))

export const summarySuggestionRelations = relations(summarySuggestion, ({ one }) => ({
  summaryJob: one(summaryJob, { relationName: "SummarySuggestion_summaryJob", fields: [summarySuggestion.summaryJobId], references: [summaryJob.id] }),
}))

export const playerCharacterRelations = relations(playerCharacter, ({ one, many }) => ({
  owner: one(user, { relationName: "PlayerCharacter_owner", fields: [playerCharacter.ownerId], references: [user.id] }),
  portraitArtifact: one(artifact, { relationName: "PlayerCharacter_portraitArtifact", fields: [playerCharacter.portraitArtifactId], references: [artifact.id] }),
  campaignLinks: many(campaignCharacter, { relationName: "CampaignCharacter_character" }),
  questSources: many(quest, { relationName: "Quest_sourceCharacter" }),
  imports: many(characterImport, { relationName: "CharacterImport_character" }),
  importSettings: one(characterImportSettings, { fields: [playerCharacter.id], references: [characterImportSettings.characterId], relationName: "CharacterImportSettings_character" }) as unknown as One<"CharacterImportSettings", false>,
}))

export const campaignCharacterRelations = relations(campaignCharacter, ({ one }) => ({
  campaign: one(campaign, { relationName: "CampaignCharacter_campaign", fields: [campaignCharacter.campaignId], references: [campaign.id] }),
  character: one(playerCharacter, { relationName: "CampaignCharacter_character", fields: [campaignCharacter.characterId], references: [playerCharacter.id] }),
  glossaryEntry: one(glossaryEntry, { relationName: "CampaignCharacter_glossaryEntry", fields: [campaignCharacter.glossaryEntryId], references: [glossaryEntry.id] }),
}))

export const characterImportRelations = relations(characterImport, ({ one }) => ({
  character: one(playerCharacter, { relationName: "CharacterImport_character", fields: [characterImport.characterId], references: [playerCharacter.id] }),
}))

export const characterImportSettingsRelations = relations(characterImportSettings, ({ one }) => ({
  character: one(playerCharacter, { relationName: "CharacterImportSettings_character", fields: [characterImportSettings.characterId], references: [playerCharacter.id] }),
}))
