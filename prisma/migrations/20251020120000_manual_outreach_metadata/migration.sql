ALTER TABLE "EmailSendJob"
  ADD COLUMN IF NOT EXISTS "manualCampaignId" TEXT,
  ADD COLUMN IF NOT EXISTS "manualCampaignName" TEXT,
  ADD COLUMN IF NOT EXISTS "manualCampaignSource" TEXT;

CREATE INDEX IF NOT EXISTS "EmailSendJob_manualCampaignId_idx"
  ON "EmailSendJob" ("manualCampaignId");
