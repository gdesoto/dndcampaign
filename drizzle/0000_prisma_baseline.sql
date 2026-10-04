CREATE TABLE `ActivityLog` (
	`id` text PRIMARY KEY NOT NULL,
	`actorUserId` text,
	`campaignId` text,
	`scope` text NOT NULL,
	`action` text NOT NULL,
	`targetType` text,
	`targetId` text,
	`summary` text,
	`metadata` JSONB,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `ActivityLog_scope_action_createdAt_idx` ON `ActivityLog` (`scope`,`action`,`createdAt`);--> statement-breakpoint
CREATE INDEX `ActivityLog_campaignId_createdAt_idx` ON `ActivityLog` (`campaignId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `ActivityLog_actorUserId_createdAt_idx` ON `ActivityLog` (`actorUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `ActivityLog_createdAt_idx` ON `ActivityLog` (`createdAt`);--> statement-breakpoint
CREATE TABLE `AdminAuditLog` (
	`id` text PRIMARY KEY NOT NULL,
	`actorUserId` text NOT NULL,
	`action` text NOT NULL,
	`targetType` text NOT NULL,
	`targetId` text,
	`summary` text,
	`metadata` JSONB,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `AdminAuditLog_action_createdAt_idx` ON `AdminAuditLog` (`action`,`createdAt`);--> statement-breakpoint
CREATE INDEX `AdminAuditLog_targetType_createdAt_idx` ON `AdminAuditLog` (`targetType`,`createdAt`);--> statement-breakpoint
CREATE INDEX `AdminAuditLog_actorUserId_createdAt_idx` ON `AdminAuditLog` (`actorUserId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `ApiKey` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`name` text NOT NULL,
	`prefix` text NOT NULL,
	`keyHash` text NOT NULL,
	`permissions` JSONB NOT NULL,
	`expiresAt` DATETIME,
	`lastUsedAt` DATETIME,
	`revokedAt` DATETIME,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` DATETIME NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ApiKey_expiresAt_idx` ON `ApiKey` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `ApiKey_userId_revokedAt_idx` ON `ApiKey` (`userId`,`revokedAt`);--> statement-breakpoint
CREATE UNIQUE INDEX `ApiKey_keyHash_key` ON `ApiKey` (`keyHash`);--> statement-breakpoint
CREATE TABLE `ApiKeyCampaign` (
	`apiKeyId` text NOT NULL,
	`campaignId` text NOT NULL,
	PRIMARY KEY(`apiKeyId`, `campaignId`),
	FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`apiKeyId`) REFERENCES `ApiKey`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ApiKeyCampaign_campaignId_idx` ON `ApiKeyCampaign` (`campaignId`);--> statement-breakpoint
CREATE TABLE `Artifact` (
	`id` text PRIMARY KEY NOT NULL,
	`ownerId` text NOT NULL,
	`campaignId` text,
	`provider` text NOT NULL,
	`storageKey` text NOT NULL,
	`mimeType` text NOT NULL,
	`byteSize` integer NOT NULL,
	`checksumSha256` text,
	`label` text,
	`meta` text,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Artifact_provider_storageKey_key` ON `Artifact` (`provider`,`storageKey`);--> statement-breakpoint
CREATE INDEX `Artifact_campaignId_idx` ON `Artifact` (`campaignId`);--> statement-breakpoint
CREATE INDEX `Artifact_ownerId_idx` ON `Artifact` (`ownerId`);--> statement-breakpoint
CREATE TABLE `Campaign` (
	`id` text PRIMARY KEY NOT NULL,
	`ownerId` text NOT NULL,
	`name` text NOT NULL,
	`system` text DEFAULT 'D&D 5e' NOT NULL,
	`isArchived` BOOLEAN DEFAULT false NOT NULL,
	`dungeonMasterName` text,
	`description` text,
	`currentStatus` text,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` DATETIME NOT NULL,
	FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `Campaign_ownerId_idx` ON `Campaign` (`ownerId`);--> statement-breakpoint
CREATE TABLE `CampaignCalendarConfig` (
	`id` text PRIMARY KEY NOT NULL,
	`campaignId` text NOT NULL,
	`isEnabled` BOOLEAN DEFAULT false NOT NULL,
	`name` text NOT NULL,
	`startingYear` integer NOT NULL,
	`firstWeekdayIndex` integer NOT NULL,
	`currentYear` integer NOT NULL,
	`currentMonth` integer NOT NULL,
	`currentDay` integer NOT NULL,
	`weekdaysJson` JSONB NOT NULL,
	`monthsJson` JSONB NOT NULL,
	`moonsJson` JSONB NOT NULL,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` DATETIME NOT NULL,
	FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `CampaignCalendarConfig_campaignId_isEnabled_idx` ON `CampaignCalendarConfig` (`campaignId`,`isEnabled`);--> statement-breakpoint
CREATE UNIQUE INDEX `CampaignCalendarConfig_campaignId_key` ON `CampaignCalendarConfig` (`campaignId`);--> statement-breakpoint
CREATE TABLE `CampaignCalendarEvent` (
	`id` text PRIMARY KEY NOT NULL,
	`campaignId` text NOT NULL,
	`year` integer NOT NULL,
	`month` integer NOT NULL,
	`day` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`createdByUserId` text NOT NULL,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` DATETIME NOT NULL,
	FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `CampaignCalendarEvent_createdByUserId_idx` ON `CampaignCalendarEvent` (`createdByUserId`);--> statement-breakpoint
CREATE INDEX `CampaignCalendarEvent_campaignId_createdAt_idx` ON `CampaignCalendarEvent` (`campaignId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `CampaignCalendarEvent_campaignId_year_month_day_idx` ON `CampaignCalendarEvent` (`campaignId`,`year`,`month`,`day`);--> statement-breakpoint
CREATE TABLE `CampaignCharacter` (
	`id` text PRIMARY KEY NOT NULL,
	`campaignId` text NOT NULL,
	`characterId` text NOT NULL,
	`glossaryEntryId` text,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`roleLabel` text,
	`notes` text,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` DATETIME NOT NULL,
	FOREIGN KEY (`glossaryEntryId`) REFERENCES `GlossaryEntry`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`characterId`) REFERENCES `PlayerCharacter`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `CampaignCharacter_campaignId_characterId_key` ON `CampaignCharacter` (`campaignId`,`characterId`);--> statement-breakpoint
CREATE INDEX `CampaignCharacter_glossaryEntryId_idx` ON `CampaignCharacter` (`glossaryEntryId`);--> statement-breakpoint
CREATE INDEX `CampaignCharacter_characterId_idx` ON `CampaignCharacter` (`characterId`);--> statement-breakpoint
CREATE INDEX `CampaignCharacter_campaignId_status_idx` ON `CampaignCharacter` (`campaignId`,`status`);--> statement-breakpoint
CREATE TABLE `CampaignDungeon` (
	`id` text PRIMARY KEY NOT NULL,
	`campaignId` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`theme` text NOT NULL,
	`seed` text NOT NULL,
	`gridType` text DEFAULT 'SQUARE' NOT NULL,
	`generatorVersion` text NOT NULL,
	`configJson` JSONB NOT NULL,
	`mapJson` JSONB NOT NULL,
	`playerViewJson` JSONB,
	`createdByUserId` text NOT NULL,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` DATETIME NOT NULL,
	FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `CampaignDungeon_createdByUserId_idx` ON `CampaignDungeon` (`createdByUserId`);--> statement-breakpoint
CREATE INDEX `CampaignDungeon_campaignId_status_updatedAt_idx` ON `CampaignDungeon` (`campaignId`,`status`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `CampaignDungeon_campaignId_updatedAt_idx` ON `CampaignDungeon` (`campaignId`,`updatedAt`);--> statement-breakpoint
CREATE TABLE `CampaignDungeonLink` (
	`id` text PRIMARY KEY NOT NULL,
	`dungeonId` text NOT NULL,
	`roomId` text,
	`linkType` text NOT NULL,
	`targetId` text NOT NULL,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`roomId`) REFERENCES `CampaignDungeonRoom`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`dungeonId`) REFERENCES `CampaignDungeon`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `CampaignDungeonLink_linkType_targetId_idx` ON `CampaignDungeonLink` (`linkType`,`targetId`);--> statement-breakpoint
CREATE INDEX `CampaignDungeonLink_roomId_idx` ON `CampaignDungeonLink` (`roomId`);--> statement-breakpoint
CREATE INDEX `CampaignDungeonLink_dungeonId_createdAt_idx` ON `CampaignDungeonLink` (`dungeonId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `CampaignDungeonRoom` (
	`id` text PRIMARY KEY NOT NULL,
	`dungeonId` text NOT NULL,
	`roomNumber` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`gmNotes` text,
	`playerNotes` text,
	`readAloud` text,
	`tagsJson` JSONB,
	`boundsJson` JSONB,
	`state` text DEFAULT 'UNSEEN' NOT NULL,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` DATETIME NOT NULL,
	FOREIGN KEY (`dungeonId`) REFERENCES `CampaignDungeon`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `CampaignDungeonRoom_dungeonId_roomNumber_key` ON `CampaignDungeonRoom` (`dungeonId`,`roomNumber`);--> statement-breakpoint
CREATE INDEX `CampaignDungeonRoom_dungeonId_roomNumber_idx` ON `CampaignDungeonRoom` (`dungeonId`,`roomNumber`);--> statement-breakpoint
CREATE TABLE `CampaignDungeonSnapshot` (
	`id` text PRIMARY KEY NOT NULL,
	`dungeonId` text NOT NULL,
	`snapshotType` text NOT NULL,
	`seed` text NOT NULL,
	`generatorVersion` text NOT NULL,
	`configJson` JSONB NOT NULL,
	`mapJson` JSONB NOT NULL,
	`createdByUserId` text NOT NULL,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`dungeonId`) REFERENCES `CampaignDungeon`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `CampaignDungeonSnapshot_createdByUserId_idx` ON `CampaignDungeonSnapshot` (`createdByUserId`);--> statement-breakpoint
CREATE INDEX `CampaignDungeonSnapshot_dungeonId_createdAt_idx` ON `CampaignDungeonSnapshot` (`dungeonId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `CampaignEncounter` (
	`id` text PRIMARY KEY NOT NULL,
	`campaignId` text NOT NULL,
	`sessionId` text,
	`name` text NOT NULL,
	`type` text DEFAULT 'COMBAT' NOT NULL,
	`status` text DEFAULT 'PLANNED' NOT NULL,
	`visibility` text DEFAULT 'SHARED' NOT NULL,
	`notes` text,
	`calendarYear` integer,
	`calendarMonth` integer,
	`calendarDay` integer,
	`currentRound` integer DEFAULT 1 NOT NULL,
	`currentTurnIndex` integer DEFAULT 0 NOT NULL,
	`createdByUserId` text NOT NULL,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` DATETIME NOT NULL,
	FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`sessionId`) REFERENCES `Session`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `CampaignEncounter_createdByUserId_idx` ON `CampaignEncounter` (`createdByUserId`);--> statement-breakpoint
CREATE INDEX `CampaignEncounter_sessionId_idx` ON `CampaignEncounter` (`sessionId`);--> statement-breakpoint
CREATE INDEX `CampaignEncounter_campaignId_status_updatedAt_idx` ON `CampaignEncounter` (`campaignId`,`status`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `CampaignEncounter_campaignId_createdAt_idx` ON `CampaignEncounter` (`campaignId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `CampaignInvite` (
	`id` text PRIMARY KEY NOT NULL,
	`campaignId` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`tokenHash` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`expiresAt` DATETIME NOT NULL,
	`invitedByUserId` text NOT NULL,
	`acceptedByUserId` text,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` DATETIME NOT NULL,
	FOREIGN KEY (`acceptedByUserId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`invitedByUserId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `CampaignInvite_expiresAt_idx` ON `CampaignInvite` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `CampaignInvite_email_status_idx` ON `CampaignInvite` (`email`,`status`);--> statement-breakpoint
CREATE INDEX `CampaignInvite_campaignId_status_idx` ON `CampaignInvite` (`campaignId`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `CampaignInvite_tokenHash_key` ON `CampaignInvite` (`tokenHash`);--> statement-breakpoint
CREATE TABLE `CampaignJournalEntry` (
	`id` text PRIMARY KEY NOT NULL,
	`campaignId` text NOT NULL,
	`authorUserId` text NOT NULL,
	`holderUserId` text,
	`discoveredByUserId` text,
	`archivedByUserId` text,
	`title` text NOT NULL,
	`contentMarkdown` text NOT NULL,
	`visibility` text DEFAULT 'MYSELF' NOT NULL,
	`isDiscoverable` BOOLEAN DEFAULT false NOT NULL,
	`discoveredAt` DATETIME,
	`isArchived` BOOLEAN DEFAULT false NOT NULL,
	`archivedAt` DATETIME,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` DATETIME NOT NULL,
	FOREIGN KEY (`archivedByUserId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`discoveredByUserId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`holderUserId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`authorUserId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `CampaignJournalEntry_campaignId_isArchived_updatedAt_idx` ON `CampaignJournalEntry` (`campaignId`,`isArchived`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `CampaignJournalEntry_campaignId_holderUserId_updatedAt_idx` ON `CampaignJournalEntry` (`campaignId`,`holderUserId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `CampaignJournalEntry_campaignId_isDiscoverable_updatedAt_idx` ON `CampaignJournalEntry` (`campaignId`,`isDiscoverable`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `CampaignJournalEntry_campaignId_createdAt_idx` ON `CampaignJournalEntry` (`campaignId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `CampaignJournalEntry_campaignId_authorUserId_createdAt_idx` ON `CampaignJournalEntry` (`campaignId`,`authorUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `CampaignJournalEntry_campaignId_visibility_createdAt_idx` ON `CampaignJournalEntry` (`campaignId`,`visibility`,`createdAt`);--> statement-breakpoint
CREATE TABLE `CampaignJournalEntrySessionLink` (
	`id` text PRIMARY KEY NOT NULL,
	`campaignJournalEntryId` text NOT NULL,
	`sessionId` text NOT NULL,
	`campaignId` text NOT NULL,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`sessionId`,`campaignId`) REFERENCES `Session`(`id`,`campaignId`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`campaignJournalEntryId`) REFERENCES `CampaignJournalEntry`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `CampaignJournalEntrySessionLink_campaignJournalEntryId_sessionId_key` ON `CampaignJournalEntrySessionLink` (`campaignJournalEntryId`,`sessionId`);--> statement-breakpoint
CREATE INDEX `CampaignJournalEntrySessionLink_campaignJournalEntryId_createdAt_idx` ON `CampaignJournalEntrySessionLink` (`campaignJournalEntryId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `CampaignJournalEntrySessionLink_campaignId_sessionId_idx` ON `CampaignJournalEntrySessionLink` (`campaignId`,`sessionId`);--> statement-breakpoint
CREATE TABLE `CampaignJournalEntryTransferHistory` (
	`id` text PRIMARY KEY NOT NULL,
	`campaignJournalEntryId` text NOT NULL,
	`campaignId` text NOT NULL,
	`fromHolderUserId` text,
	`toHolderUserId` text,
	`actorUserId` text NOT NULL,
	`action` text NOT NULL,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`toHolderUserId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`fromHolderUserId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`campaignJournalEntryId`) REFERENCES `CampaignJournalEntry`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `CampaignJournalEntryTransferHistory_campaignId_createdAt_idx` ON `CampaignJournalEntryTransferHistory` (`campaignId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `CampaignJournalEntryTransferHistory_campaignJournalEntryId_createdAt_idx` ON `CampaignJournalEntryTransferHistory` (`campaignJournalEntryId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `CampaignJournalTag` (
	`id` text PRIMARY KEY NOT NULL,
	`campaignJournalEntryId` text NOT NULL,
	`campaignId` text NOT NULL,
	`tagType` text NOT NULL,
	`normalizedLabel` text NOT NULL,
	`displayLabel` text NOT NULL,
	`glossaryEntryId` text,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`glossaryEntryId`) REFERENCES `GlossaryEntry`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`campaignJournalEntryId`) REFERENCES `CampaignJournalEntry`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `CampaignJournalTag_campaignJournalEntryId_tagType_normalizedLabel_key` ON `CampaignJournalTag` (`campaignJournalEntryId`,`tagType`,`normalizedLabel`);--> statement-breakpoint
CREATE INDEX `CampaignJournalTag_campaignId_glossaryEntryId_idx` ON `CampaignJournalTag` (`campaignId`,`glossaryEntryId`);--> statement-breakpoint
CREATE INDEX `CampaignJournalTag_campaignJournalEntryId_tagType_idx` ON `CampaignJournalTag` (`campaignJournalEntryId`,`tagType`);--> statement-breakpoint
CREATE INDEX `CampaignJournalTag_campaignId_normalizedLabel_idx` ON `CampaignJournalTag` (`campaignId`,`normalizedLabel`);--> statement-breakpoint
CREATE TABLE `CampaignMap` (
	`id` text PRIMARY KEY NOT NULL,
	`campaignId` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`isPrimary` BOOLEAN DEFAULT false NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`sourceType` text DEFAULT 'AZGAAR_FULL_JSON' NOT NULL,
	`createdById` text NOT NULL,
	`rawManifestJson` JSONB,
	`importVersion` integer DEFAULT 1 NOT NULL,
	`sourceFingerprint` text NOT NULL,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` DATETIME NOT NULL,
	FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `CampaignMap_campaignId_slug_key` ON `CampaignMap` (`campaignId`,`slug`);--> statement-breakpoint
CREATE INDEX `CampaignMap_campaignId_isPrimary_idx` ON `CampaignMap` (`campaignId`,`isPrimary`);--> statement-breakpoint
CREATE INDEX `CampaignMap_campaignId_idx` ON `CampaignMap` (`campaignId`);--> statement-breakpoint
CREATE TABLE `CampaignMapFeature` (
	`id` text PRIMARY KEY NOT NULL,
	`campaignMapId` text NOT NULL,
	`externalId` text NOT NULL,
	`featureType` text NOT NULL,
	`name` text NOT NULL,
	`displayName` text NOT NULL,
	`normalizedName` text NOT NULL,
	`description` text,
	`geometryType` text NOT NULL,
	`geometryJson` JSONB NOT NULL,
	`propertiesJson` JSONB,
	`sourceRef` text NOT NULL,
	`isActive` BOOLEAN DEFAULT true NOT NULL,
	`removed` BOOLEAN DEFAULT false NOT NULL,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` DATETIME NOT NULL,
	FOREIGN KEY (`campaignMapId`) REFERENCES `CampaignMap`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `CampaignMapFeature_campaignMapId_featureType_externalId_key` ON `CampaignMapFeature` (`campaignMapId`,`featureType`,`externalId`);--> statement-breakpoint
CREATE INDEX `CampaignMapFeature_campaignMapId_normalizedName_idx` ON `CampaignMapFeature` (`campaignMapId`,`normalizedName`);--> statement-breakpoint
CREATE INDEX `CampaignMapFeature_campaignMapId_featureType_idx` ON `CampaignMapFeature` (`campaignMapId`,`featureType`);--> statement-breakpoint
CREATE INDEX `CampaignMapFeature_campaignMapId_idx` ON `CampaignMapFeature` (`campaignMapId`);--> statement-breakpoint
CREATE TABLE `CampaignMapFile` (
	`id` text PRIMARY KEY NOT NULL,
	`campaignMapId` text NOT NULL,
	`kind` text NOT NULL,
	`storageProvider` text NOT NULL,
	`storageKey` text NOT NULL,
	`contentType` text NOT NULL,
	`sizeBytes` integer NOT NULL,
	`checksum` text,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`campaignMapId`) REFERENCES `CampaignMap`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `CampaignMapFile_kind_idx` ON `CampaignMapFile` (`kind`);--> statement-breakpoint
CREATE INDEX `CampaignMapFile_campaignMapId_idx` ON `CampaignMapFile` (`campaignMapId`);--> statement-breakpoint
CREATE TABLE `CampaignMapGlossaryLink` (
	`id` text PRIMARY KEY NOT NULL,
	`campaignMapId` text NOT NULL,
	`mapFeatureId` text NOT NULL,
	`glossaryEntryId` text NOT NULL,
	`linkType` text NOT NULL,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`glossaryEntryId`) REFERENCES `GlossaryEntry`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`mapFeatureId`) REFERENCES `CampaignMapFeature`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`campaignMapId`) REFERENCES `CampaignMap`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `CampaignMapGlossaryLink_mapFeatureId_glossaryEntryId_key` ON `CampaignMapGlossaryLink` (`mapFeatureId`,`glossaryEntryId`);--> statement-breakpoint
CREATE INDEX `CampaignMapGlossaryLink_glossaryEntryId_idx` ON `CampaignMapGlossaryLink` (`glossaryEntryId`);--> statement-breakpoint
CREATE INDEX `CampaignMapGlossaryLink_campaignMapId_idx` ON `CampaignMapGlossaryLink` (`campaignMapId`);--> statement-breakpoint
CREATE TABLE `CampaignMember` (
	`id` text PRIMARY KEY NOT NULL,
	`campaignId` text NOT NULL,
	`userId` text NOT NULL,
	`role` text NOT NULL,
	`invitedByUserId` text NOT NULL,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` DATETIME NOT NULL,
	`hasDmAccess` BOOLEAN DEFAULT false NOT NULL,
	FOREIGN KEY (`invitedByUserId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `CampaignMember_campaignId_userId_key` ON `CampaignMember` (`campaignId`,`userId`);--> statement-breakpoint
CREATE INDEX `CampaignMember_campaignId_role_idx` ON `CampaignMember` (`campaignId`,`role`);--> statement-breakpoint
CREATE INDEX `CampaignMember_userId_idx` ON `CampaignMember` (`userId`);--> statement-breakpoint
CREATE TABLE `CampaignPublicAccess` (
	`campaignId` text PRIMARY KEY NOT NULL,
	`isEnabled` BOOLEAN DEFAULT false NOT NULL,
	`isListed` BOOLEAN DEFAULT false NOT NULL,
	`publicSlug` text NOT NULL,
	`showCharacters` BOOLEAN DEFAULT false NOT NULL,
	`showRecaps` BOOLEAN DEFAULT false NOT NULL,
	`showSessions` BOOLEAN DEFAULT false NOT NULL,
	`showGlossary` BOOLEAN DEFAULT false NOT NULL,
	`showQuests` BOOLEAN DEFAULT false NOT NULL,
	`showMilestones` BOOLEAN DEFAULT false NOT NULL,
	`showMaps` BOOLEAN DEFAULT false NOT NULL,
	`showJournal` BOOLEAN DEFAULT false NOT NULL,
	`updatedByUserId` text NOT NULL,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` DATETIME NOT NULL,
	FOREIGN KEY (`updatedByUserId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `CampaignPublicAccess_isEnabled_idx` ON `CampaignPublicAccess` (`isEnabled`);--> statement-breakpoint
CREATE UNIQUE INDEX `CampaignPublicAccess_publicSlug_key` ON `CampaignPublicAccess` (`publicSlug`);--> statement-breakpoint
CREATE TABLE `CampaignRequest` (
	`id` text PRIMARY KEY NOT NULL,
	`campaignId` text NOT NULL,
	`createdByUserId` text NOT NULL,
	`type` text NOT NULL,
	`visibility` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`decisionNote` text,
	`decidedByUserId` text,
	`decidedAt` DATETIME,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` DATETIME NOT NULL,
	FOREIGN KEY (`decidedByUserId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `CampaignRequest_campaignId_status_decidedAt_idx` ON `CampaignRequest` (`campaignId`,`status`,`decidedAt`);--> statement-breakpoint
CREATE INDEX `CampaignRequest_campaignId_createdByUserId_createdAt_idx` ON `CampaignRequest` (`campaignId`,`createdByUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `CampaignRequest_campaignId_visibility_status_createdAt_idx` ON `CampaignRequest` (`campaignId`,`visibility`,`status`,`createdAt`);--> statement-breakpoint
CREATE TABLE `CampaignRequestVote` (
	`id` text PRIMARY KEY NOT NULL,
	`campaignRequestId` text NOT NULL,
	`campaignId` text NOT NULL,
	`userId` text NOT NULL,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`campaignRequestId`) REFERENCES `CampaignRequest`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `CampaignRequestVote_campaignRequestId_userId_key` ON `CampaignRequestVote` (`campaignRequestId`,`userId`);--> statement-breakpoint
CREATE INDEX `CampaignRequestVote_campaignId_userId_createdAt_idx` ON `CampaignRequestVote` (`campaignId`,`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `CampaignRequestVote_campaignRequestId_createdAt_idx` ON `CampaignRequestVote` (`campaignRequestId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `CharacterImport` (
	`id` text PRIMARY KEY NOT NULL,
	`characterId` text NOT NULL,
	`provider` text NOT NULL,
	`externalId` text,
	`sourceUrl` text,
	`rawJson` JSONB NOT NULL,
	`rawHash` text NOT NULL,
	`importedAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`lastSyncedAt` DATETIME,
	`lastSyncStatus` text,
	`lastSyncMessage` text,
	FOREIGN KEY (`characterId`) REFERENCES `PlayerCharacter`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `CharacterImport_provider_externalId_idx` ON `CharacterImport` (`provider`,`externalId`);--> statement-breakpoint
CREATE INDEX `CharacterImport_characterId_idx` ON `CharacterImport` (`characterId`);--> statement-breakpoint
CREATE TABLE `CharacterImportSettings` (
	`characterId` text PRIMARY KEY NOT NULL,
	`lockedSections` JSONB,
	`defaultOverwriteMode` text DEFAULT 'SECTIONS' NOT NULL,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` DATETIME NOT NULL,
	FOREIGN KEY (`characterId`) REFERENCES `PlayerCharacter`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `Document` (
	`id` text PRIMARY KEY NOT NULL,
	`campaignId` text NOT NULL,
	`sessionId` text,
	`recordingId` text,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`currentVersionId` text,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` DATETIME NOT NULL,
	FOREIGN KEY (`currentVersionId`) REFERENCES `DocumentVersion`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`recordingId`) REFERENCES `Recording`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`sessionId`) REFERENCES `Session`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Document_sessionId_type_key` ON `Document` (`sessionId`,`type`);--> statement-breakpoint
CREATE INDEX `Document_recordingId_idx` ON `Document` (`recordingId`);--> statement-breakpoint
CREATE INDEX `Document_sessionId_idx` ON `Document` (`sessionId`);--> statement-breakpoint
CREATE INDEX `Document_campaignId_idx` ON `Document` (`campaignId`);--> statement-breakpoint
CREATE UNIQUE INDEX `Document_currentVersionId_key` ON `Document` (`currentVersionId`);--> statement-breakpoint
CREATE TABLE `DocumentVersion` (
	`id` text PRIMARY KEY NOT NULL,
	`documentId` text NOT NULL,
	`versionNumber` integer NOT NULL,
	`content` text NOT NULL,
	`format` text DEFAULT 'MARKDOWN' NOT NULL,
	`source` text DEFAULT 'USER_EDIT' NOT NULL,
	`createdByUserId` text,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`documentId`) REFERENCES `Document`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `DocumentVersion_documentId_versionNumber_key` ON `DocumentVersion` (`documentId`,`versionNumber`);--> statement-breakpoint
CREATE INDEX `DocumentVersion_createdByUserId_idx` ON `DocumentVersion` (`createdByUserId`);--> statement-breakpoint
CREATE TABLE `EncounterCombatant` (
	`id` text PRIMARY KEY NOT NULL,
	`encounterId` text NOT NULL,
	`name` text NOT NULL,
	`side` text DEFAULT 'ENEMY' NOT NULL,
	`sourceType` text DEFAULT 'CUSTOM' NOT NULL,
	`sourceCampaignCharacterId` text,
	`sourcePlayerCharacterId` text,
	`sourceGlossaryEntryId` text,
	`sourceStatBlockId` text,
	`initiative` integer,
	`sortOrder` integer NOT NULL,
	`maxHp` integer,
	`currentHp` integer,
	`tempHp` integer DEFAULT 0 NOT NULL,
	`armorClass` integer,
	`speed` integer,
	`isConcentrating` BOOLEAN DEFAULT false NOT NULL,
	`deathSaveSuccesses` integer DEFAULT 0 NOT NULL,
	`deathSaveFailures` integer DEFAULT 0 NOT NULL,
	`isDefeated` BOOLEAN DEFAULT false NOT NULL,
	`isHidden` BOOLEAN DEFAULT false NOT NULL,
	`notes` text,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` DATETIME NOT NULL,
	FOREIGN KEY (`encounterId`) REFERENCES `CampaignEncounter`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `EncounterCombatant_encounterId_sortOrder_key` ON `EncounterCombatant` (`encounterId`,`sortOrder`);--> statement-breakpoint
CREATE INDEX `EncounterCombatant_sourceStatBlockId_idx` ON `EncounterCombatant` (`sourceStatBlockId`);--> statement-breakpoint
CREATE INDEX `EncounterCombatant_encounterId_initiative_idx` ON `EncounterCombatant` (`encounterId`,`initiative`);--> statement-breakpoint
CREATE INDEX `EncounterCombatant_encounterId_sortOrder_idx` ON `EncounterCombatant` (`encounterId`,`sortOrder`);--> statement-breakpoint
CREATE TABLE `EncounterCondition` (
	`id` text PRIMARY KEY NOT NULL,
	`combatantId` text NOT NULL,
	`name` text NOT NULL,
	`duration` integer,
	`remaining` integer,
	`tickTiming` text DEFAULT 'TURN_END' NOT NULL,
	`source` text,
	`notes` text,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` DATETIME NOT NULL,
	FOREIGN KEY (`combatantId`) REFERENCES `EncounterCombatant`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `EncounterCondition_combatantId_createdAt_idx` ON `EncounterCondition` (`combatantId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `EncounterEvent` (
	`id` text PRIMARY KEY NOT NULL,
	`encounterId` text NOT NULL,
	`eventType` text NOT NULL,
	`summary` text NOT NULL,
	`payload` JSONB,
	`createdByUserId` text,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`encounterId`) REFERENCES `CampaignEncounter`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `EncounterEvent_createdByUserId_idx` ON `EncounterEvent` (`createdByUserId`);--> statement-breakpoint
CREATE INDEX `EncounterEvent_eventType_createdAt_idx` ON `EncounterEvent` (`eventType`,`createdAt`);--> statement-breakpoint
CREATE INDEX `EncounterEvent_encounterId_createdAt_idx` ON `EncounterEvent` (`encounterId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `EncounterStatBlock` (
	`id` text PRIMARY KEY NOT NULL,
	`campaignId` text NOT NULL,
	`name` text NOT NULL,
	`challengeRating` text,
	`statBlockJson` JSONB NOT NULL,
	`notes` text,
	`createdByUserId` text NOT NULL,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` DATETIME NOT NULL,
	FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `EncounterStatBlock_campaignId_name_key` ON `EncounterStatBlock` (`campaignId`,`name`);--> statement-breakpoint
CREATE INDEX `EncounterStatBlock_createdByUserId_idx` ON `EncounterStatBlock` (`createdByUserId`);--> statement-breakpoint
CREATE INDEX `EncounterStatBlock_campaignId_createdAt_idx` ON `EncounterStatBlock` (`campaignId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `EncounterTemplate` (
	`id` text PRIMARY KEY NOT NULL,
	`campaignId` text NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'COMBAT' NOT NULL,
	`notes` text,
	`createdByUserId` text NOT NULL,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` DATETIME NOT NULL,
	FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `EncounterTemplate_createdByUserId_idx` ON `EncounterTemplate` (`createdByUserId`);--> statement-breakpoint
CREATE INDEX `EncounterTemplate_campaignId_createdAt_idx` ON `EncounterTemplate` (`campaignId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `EncounterTemplateCombatant` (
	`id` text PRIMARY KEY NOT NULL,
	`templateId` text NOT NULL,
	`name` text NOT NULL,
	`side` text DEFAULT 'ENEMY' NOT NULL,
	`sourceType` text DEFAULT 'CUSTOM' NOT NULL,
	`sourceStatBlockId` text,
	`maxHp` integer,
	`armorClass` integer,
	`speed` integer,
	`quantity` integer DEFAULT 1 NOT NULL,
	`sortOrder` integer NOT NULL,
	`notes` text,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` DATETIME NOT NULL,
	FOREIGN KEY (`templateId`) REFERENCES `EncounterTemplate`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `EncounterTemplateCombatant_templateId_sortOrder_key` ON `EncounterTemplateCombatant` (`templateId`,`sortOrder`);--> statement-breakpoint
CREATE INDEX `EncounterTemplateCombatant_templateId_sortOrder_idx` ON `EncounterTemplateCombatant` (`templateId`,`sortOrder`);--> statement-breakpoint
CREATE TABLE `GlossaryEntry` (
	`id` text PRIMARY KEY NOT NULL,
	`campaignId` text NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`aliases` text,
	`description` text NOT NULL,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` DATETIME NOT NULL,
	`sourceMapId` text,
	`sourceMapFeatureId` text,
	FOREIGN KEY (`sourceMapFeatureId`) REFERENCES `CampaignMapFeature`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`sourceMapId`) REFERENCES `CampaignMap`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `GlossaryEntry_sourceMapFeatureId_idx` ON `GlossaryEntry` (`sourceMapFeatureId`);--> statement-breakpoint
CREATE INDEX `GlossaryEntry_sourceMapId_idx` ON `GlossaryEntry` (`sourceMapId`);--> statement-breakpoint
CREATE INDEX `GlossaryEntry_campaignId_type_idx` ON `GlossaryEntry` (`campaignId`,`type`);--> statement-breakpoint
CREATE TABLE `GlossarySessionLink` (
	`id` text PRIMARY KEY NOT NULL,
	`glossaryEntryId` text NOT NULL,
	`sessionId` text NOT NULL,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`sessionId`) REFERENCES `Session`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`glossaryEntryId`) REFERENCES `GlossaryEntry`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `GlossarySessionLink_glossaryEntryId_sessionId_key` ON `GlossarySessionLink` (`glossaryEntryId`,`sessionId`);--> statement-breakpoint
CREATE INDEX `GlossarySessionLink_sessionId_idx` ON `GlossarySessionLink` (`sessionId`);--> statement-breakpoint
CREATE TABLE `Milestone` (
	`id` text PRIMARY KEY NOT NULL,
	`campaignId` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`isComplete` BOOLEAN DEFAULT false NOT NULL,
	`completedAt` DATETIME,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` DATETIME NOT NULL,
	FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `Milestone_campaignId_idx` ON `Milestone` (`campaignId`);--> statement-breakpoint
CREATE TABLE `PlayerCharacter` (
	`id` text PRIMARY KEY NOT NULL,
	`ownerId` text NOT NULL,
	`name` text NOT NULL,
	`status` text,
	`portraitUrl` text,
	`portraitArtifactId` text,
	`sheetJson` JSONB NOT NULL,
	`summaryJson` JSONB NOT NULL,
	`sourceProvider` text DEFAULT 'MANUAL' NOT NULL,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` DATETIME NOT NULL,
	FOREIGN KEY (`portraitArtifactId`) REFERENCES `Artifact`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `PlayerCharacter_name_idx` ON `PlayerCharacter` (`name`);--> statement-breakpoint
CREATE INDEX `PlayerCharacter_ownerId_idx` ON `PlayerCharacter` (`ownerId`);--> statement-breakpoint
CREATE TABLE `Quest` (
	`id` text PRIMARY KEY NOT NULL,
	`campaignId` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`type` text DEFAULT 'CAMPAIGN' NOT NULL,
	`track` text DEFAULT 'SIDE' NOT NULL,
	`sourceType` text DEFAULT 'FREE_TEXT' NOT NULL,
	`sourceText` text,
	`sourceNpcId` text,
	`sourceCharacterId` text,
	`reward` text,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`progressNotes` text,
	`expirationYear` integer,
	`expirationMonth` integer,
	`expirationDay` integer,
	`sortOrder` integer DEFAULT 0 NOT NULL,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` DATETIME NOT NULL,
	FOREIGN KEY (`sourceCharacterId`) REFERENCES `PlayerCharacter`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`sourceNpcId`) REFERENCES `GlossaryEntry`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `Quest_sourceCharacterId_idx` ON `Quest` (`sourceCharacterId`);--> statement-breakpoint
CREATE INDEX `Quest_sourceNpcId_idx` ON `Quest` (`sourceNpcId`);--> statement-breakpoint
CREATE INDEX `Quest_campaignId_idx` ON `Quest` (`campaignId`);--> statement-breakpoint
CREATE TABLE `RecapRecording` (
	`id` text PRIMARY KEY NOT NULL,
	`sessionId` text NOT NULL,
	`filename` text NOT NULL,
	`mimeType` text NOT NULL,
	`byteSize` integer NOT NULL,
	`durationSeconds` integer,
	`artifactId` text NOT NULL,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` DATETIME NOT NULL,
	`kind` text DEFAULT 'AUDIO' NOT NULL,
	FOREIGN KEY (`artifactId`) REFERENCES `Artifact`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`sessionId`) REFERENCES `Session`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `RecapRecording_sessionId_kind_key` ON `RecapRecording` (`sessionId`,`kind`);--> statement-breakpoint
CREATE INDEX `RecapRecording_artifactId_idx` ON `RecapRecording` (`artifactId`);--> statement-breakpoint
CREATE TABLE `Recording` (
	`id` text PRIMARY KEY NOT NULL,
	`sessionId` text NOT NULL,
	`kind` text NOT NULL,
	`filename` text NOT NULL,
	`mimeType` text NOT NULL,
	`byteSize` integer NOT NULL,
	`durationSeconds` integer,
	`artifactId` text NOT NULL,
	`vttArtifactId` text,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` DATETIME NOT NULL,
	FOREIGN KEY (`vttArtifactId`) REFERENCES `Artifact`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`artifactId`) REFERENCES `Artifact`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`sessionId`) REFERENCES `Session`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `Recording_vttArtifactId_idx` ON `Recording` (`vttArtifactId`);--> statement-breakpoint
CREATE INDEX `Recording_artifactId_idx` ON `Recording` (`artifactId`);--> statement-breakpoint
CREATE INDEX `Recording_sessionId_idx` ON `Recording` (`sessionId`);--> statement-breakpoint
CREATE TABLE `Session` (
	`id` text PRIMARY KEY NOT NULL,
	`campaignId` text NOT NULL,
	`title` text NOT NULL,
	`sessionNumber` integer,
	`playedAt` DATETIME,
	`notes` text,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` DATETIME NOT NULL,
	`guestDungeonMasterName` text,
	FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Session_id_campaignId_key` ON `Session` (`id`,`campaignId`);--> statement-breakpoint
CREATE INDEX `Session_campaignId_idx` ON `Session` (`campaignId`);--> statement-breakpoint
CREATE TABLE `SessionCalendarRange` (
	`id` text PRIMARY KEY NOT NULL,
	`sessionId` text NOT NULL,
	`campaignId` text NOT NULL,
	`startYear` integer NOT NULL,
	`startMonth` integer NOT NULL,
	`startDay` integer NOT NULL,
	`endYear` integer NOT NULL,
	`endMonth` integer NOT NULL,
	`endDay` integer NOT NULL,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` DATETIME NOT NULL,
	FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`sessionId`,`campaignId`) REFERENCES `Session`(`id`,`campaignId`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `SessionCalendarRange_sessionId_campaignId_key` ON `SessionCalendarRange` (`sessionId`,`campaignId`);--> statement-breakpoint
CREATE INDEX `SessionCalendarRange_campaignId_endYear_endMonth_endDay_idx` ON `SessionCalendarRange` (`campaignId`,`endYear`,`endMonth`,`endDay`);--> statement-breakpoint
CREATE INDEX `SessionCalendarRange_campaignId_startYear_startMonth_startDay_idx` ON `SessionCalendarRange` (`campaignId`,`startYear`,`startMonth`,`startDay`);--> statement-breakpoint
CREATE INDEX `SessionCalendarRange_campaignId_idx` ON `SessionCalendarRange` (`campaignId`);--> statement-breakpoint
CREATE UNIQUE INDEX `SessionCalendarRange_sessionId_key` ON `SessionCalendarRange` (`sessionId`);--> statement-breakpoint
CREATE TABLE `SummaryJob` (
	`id` text PRIMARY KEY NOT NULL,
	`campaignId` text NOT NULL,
	`sessionId` text NOT NULL,
	`documentId` text NOT NULL,
	`summaryDocumentId` text,
	`trackingId` text NOT NULL,
	`status` text NOT NULL,
	`mode` text NOT NULL,
	`promptProfile` text,
	`webhookUrl` text,
	`requestHash` text,
	`responseHash` text,
	`errorMessage` text,
	`meta` JSONB,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` DATETIME NOT NULL,
	`kind` text DEFAULT 'SUMMARY_GENERATION' NOT NULL,
	FOREIGN KEY (`summaryDocumentId`) REFERENCES `Document`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`documentId`) REFERENCES `Document`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`sessionId`) REFERENCES `Session`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `SummaryJob_sessionId_kind_createdAt_idx` ON `SummaryJob` (`sessionId`,`kind`,`createdAt`);--> statement-breakpoint
CREATE INDEX `SummaryJob_kind_idx` ON `SummaryJob` (`kind`);--> statement-breakpoint
CREATE INDEX `SummaryJob_status_idx` ON `SummaryJob` (`status`);--> statement-breakpoint
CREATE INDEX `SummaryJob_documentId_idx` ON `SummaryJob` (`documentId`);--> statement-breakpoint
CREATE INDEX `SummaryJob_sessionId_idx` ON `SummaryJob` (`sessionId`);--> statement-breakpoint
CREATE INDEX `SummaryJob_campaignId_idx` ON `SummaryJob` (`campaignId`);--> statement-breakpoint
CREATE UNIQUE INDEX `SummaryJob_trackingId_key` ON `SummaryJob` (`trackingId`);--> statement-breakpoint
CREATE TABLE `SummarySuggestion` (
	`id` text PRIMARY KEY NOT NULL,
	`summaryJobId` text NOT NULL,
	`entityType` text NOT NULL,
	`action` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`match` JSONB,
	`payload` JSONB NOT NULL,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` DATETIME NOT NULL,
	FOREIGN KEY (`summaryJobId`) REFERENCES `SummaryJob`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `SummarySuggestion_status_idx` ON `SummarySuggestion` (`status`);--> statement-breakpoint
CREATE INDEX `SummarySuggestion_summaryJobId_idx` ON `SummarySuggestion` (`summaryJobId`);--> statement-breakpoint
CREATE TABLE `TranscriptionArtifact` (
	`id` text PRIMARY KEY NOT NULL,
	`transcriptionJobId` text NOT NULL,
	`artifactId` text NOT NULL,
	`format` text NOT NULL,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`artifactId`) REFERENCES `Artifact`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`transcriptionJobId`) REFERENCES `TranscriptionJob`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `TranscriptionArtifact_transcriptionJobId_format_key` ON `TranscriptionArtifact` (`transcriptionJobId`,`format`);--> statement-breakpoint
CREATE INDEX `TranscriptionArtifact_artifactId_idx` ON `TranscriptionArtifact` (`artifactId`);--> statement-breakpoint
CREATE TABLE `TranscriptionJob` (
	`id` text PRIMARY KEY NOT NULL,
	`recordingId` text NOT NULL,
	`provider` text NOT NULL,
	`status` text NOT NULL,
	`requestId` text,
	`externalJobId` text,
	`modelId` text,
	`languageCode` text,
	`numSpeakers` integer,
	`diarize` BOOLEAN DEFAULT true NOT NULL,
	`tagAudioEvents` BOOLEAN DEFAULT false NOT NULL,
	`requestedFormats` text,
	`keyterms` text,
	`errorMessage` text,
	`completedAt` DATETIME,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` DATETIME NOT NULL,
	FOREIGN KEY (`recordingId`) REFERENCES `Recording`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `TranscriptionJob_status_idx` ON `TranscriptionJob` (`status`);--> statement-breakpoint
CREATE INDEX `TranscriptionJob_recordingId_idx` ON `TranscriptionJob` (`recordingId`);--> statement-breakpoint
CREATE UNIQUE INDEX `TranscriptionJob_externalJobId_key` ON `TranscriptionJob` (`externalJobId`);--> statement-breakpoint
CREATE TABLE `User` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`passwordHash` text,
	`name` text NOT NULL,
	`systemRole` text DEFAULT 'USER' NOT NULL,
	`isActive` BOOLEAN DEFAULT true NOT NULL,
	`lastLoginAt` DATETIME,
	`avatarUrl` text,
	`deletedAt` DATETIME,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` DATETIME NOT NULL
);
--> statement-breakpoint
CREATE INDEX `User_email_idx` ON `User` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `User_email_key` ON `User` (`email`);