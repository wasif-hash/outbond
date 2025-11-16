-- CreateTable
CREATE TABLE "public"."ManualCampaignDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "workflowState" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualCampaignDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManualCampaignDraft_userId_idx" ON "public"."ManualCampaignDraft"("userId");

-- AddForeignKey
ALTER TABLE "public"."ManualCampaignDraft" ADD CONSTRAINT "ManualCampaignDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
