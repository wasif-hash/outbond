-- CreateEnum
CREATE TYPE "public"."JobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "public"."Campaign" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nicheOrJobTitle" TEXT NOT NULL,
    "keywords" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "googleSheetId" TEXT NOT NULL,
    "maxLeads" INTEGER NOT NULL DEFAULT 1000,
    "pageSize" INTEGER NOT NULL DEFAULT 50,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CampaignJob" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "public"."JobStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "totalPages" INTEGER NOT NULL DEFAULT 0,
    "leadsProcessed" INTEGER NOT NULL DEFAULT 0,
    "leadsWritten" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."JobAttempt" (
    "id" TEXT NOT NULL,
    "campaignJobId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" "public"."JobStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "error" TEXT,
    "pagesProcessed" INTEGER NOT NULL DEFAULT 0,
    "leadsFound" INTEGER NOT NULL DEFAULT 0,
    "leadsWritten" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "JobAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Lead" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "jobTitle" TEXT,
    "website" TEXT,
    "linkedinUrl" TEXT,
    "industry" TEXT,
    "location" TEXT,
    "source" TEXT NOT NULL DEFAULT 'instantly',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isValid" BOOLEAN NOT NULL DEFAULT true,
    "isSuppressed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "lastRefill" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maxTokens" INTEGER NOT NULL,
    "refillRate" INTEGER NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."JobLock" (
    "id" TEXT NOT NULL,
    "lockKey" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobLock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Campaign_userId_idx" ON "public"."Campaign"("userId");

-- CreateIndex
CREATE INDEX "Campaign_userId_isActive_idx" ON "public"."Campaign"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignJob_idempotencyKey_key" ON "public"."CampaignJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CampaignJob_status_idx" ON "public"."CampaignJob"("status");

-- CreateIndex
CREATE INDEX "CampaignJob_nextRunAt_idx" ON "public"."CampaignJob"("nextRunAt");

-- CreateIndex
CREATE INDEX "CampaignJob_campaignId_idx" ON "public"."CampaignJob"("campaignId");

-- CreateIndex
CREATE INDEX "JobAttempt_campaignJobId_idx" ON "public"."JobAttempt"("campaignJobId");

-- CreateIndex
CREATE INDEX "Lead_userId_idx" ON "public"."Lead"("userId");

-- CreateIndex
CREATE INDEX "Lead_campaignId_idx" ON "public"."Lead"("campaignId");

-- CreateIndex
CREATE INDEX "Lead_email_idx" ON "public"."Lead"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_email_campaignId_key" ON "public"."Lead"("email", "campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimit_key_key" ON "public"."RateLimit"("key");

-- CreateIndex
CREATE INDEX "RateLimit_key_idx" ON "public"."RateLimit"("key");

-- CreateIndex
CREATE UNIQUE INDEX "JobLock_lockKey_key" ON "public"."JobLock"("lockKey");

-- CreateIndex
CREATE INDEX "JobLock_lockKey_idx" ON "public"."JobLock"("lockKey");

-- CreateIndex
CREATE INDEX "JobLock_expiresAt_idx" ON "public"."JobLock"("expiresAt");

-- AddForeignKey
ALTER TABLE "public"."Campaign" ADD CONSTRAINT "Campaign_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Campaign" ADD CONSTRAINT "Campaign_googleSheetId_fkey" FOREIGN KEY ("googleSheetId") REFERENCES "public"."GoogleSheet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CampaignJob" ADD CONSTRAINT "CampaignJob_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "public"."Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JobAttempt" ADD CONSTRAINT "JobAttempt_campaignJobId_fkey" FOREIGN KEY ("campaignJobId") REFERENCES "public"."CampaignJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Lead" ADD CONSTRAINT "Lead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Lead" ADD CONSTRAINT "Lead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "public"."Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
