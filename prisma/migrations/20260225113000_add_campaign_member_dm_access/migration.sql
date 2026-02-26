ALTER TABLE "CampaignMember" ADD COLUMN "hasDmAccess" BOOLEAN NOT NULL DEFAULT false;

UPDATE "CampaignMember"
SET "hasDmAccess" = true
WHERE "role" = 'OWNER';
