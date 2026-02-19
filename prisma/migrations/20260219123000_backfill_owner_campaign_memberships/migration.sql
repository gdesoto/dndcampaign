-- UM-2 ownership membership backfill (data migration)
-- Safe/idempotent:
-- 1) Ensures any existing owner membership rows have role OWNER.
-- 2) Inserts missing owner membership rows.

-- Normalize existing owner membership rows to OWNER.
UPDATE "CampaignMember"
SET
  "role" = 'OWNER',
  "invitedByUserId" = (
    SELECT "ownerId"
    FROM "Campaign"
    WHERE "Campaign"."id" = "CampaignMember"."campaignId"
  ),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE
  "userId" = (
    SELECT "ownerId"
    FROM "Campaign"
    WHERE "Campaign"."id" = "CampaignMember"."campaignId"
  )
  AND "role" <> 'OWNER';

-- Insert missing owner membership rows.
INSERT INTO "CampaignMember" (
  "id",
  "campaignId",
  "userId",
  "role",
  "invitedByUserId",
  "createdAt",
  "updatedAt"
)
SELECT
  lower(hex(randomblob(4))) || '-' ||
  lower(hex(randomblob(2))) || '-4' ||
  substr(lower(hex(randomblob(2))), 2) || '-' ||
  substr('89ab', abs(random()) % 4 + 1, 1) ||
  substr(lower(hex(randomblob(2))), 2) || '-' ||
  lower(hex(randomblob(6))) AS "id",
  c."id" AS "campaignId",
  c."ownerId" AS "userId",
  'OWNER' AS "role",
  c."ownerId" AS "invitedByUserId",
  CURRENT_TIMESTAMP AS "createdAt",
  CURRENT_TIMESTAMP AS "updatedAt"
FROM "Campaign" c
WHERE NOT EXISTS (
  SELECT 1
  FROM "CampaignMember" cm
  WHERE cm."campaignId" = c."id"
    AND cm."userId" = c."ownerId"
);
