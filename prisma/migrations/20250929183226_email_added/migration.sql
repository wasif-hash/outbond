-- CreateEnum
CREATE TYPE "public"."EmailCampaignStatus" AS ENUM ('DRAFT', 'GENERATING', 'VERIFYING', 'READY', 'SENDING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."EmailGenerationStatus" AS ENUM ('PENDING', 'GENERATING', 'GENERATED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."EmailVerificationStatus" AS ENUM ('PENDING', 'VERIFYING', 'VALID', 'INVALID', 'RISKY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "public"."EmailSendStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'BOUNCED', 'SCHEDULED');

-- CreateTable
CREATE TABLE "public"."email_campaigns" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "public"."EmailCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "googleSheetId" TEXT,
    "spreadsheetId" TEXT,
    "sheetRange" TEXT,
    "googleSheetName" TEXT,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT NOT NULL,
    "replyTo" TEXT,
    "emailTemplate" TEXT,
    "customInstructions" TEXT,
    "tone" TEXT NOT NULL DEFAULT 'professional',
    "totalLeads" INTEGER NOT NULL DEFAULT 0,
    "emailsGenerated" INTEGER NOT NULL DEFAULT 0,
    "emailsVerified" INTEGER NOT NULL DEFAULT 0,
    "validEmails" INTEGER NOT NULL DEFAULT 0,
    "invalidEmails" INTEGER NOT NULL DEFAULT 0,
    "emailsSent" INTEGER NOT NULL DEFAULT 0,
    "emailsFailed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "email_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."email_campaign_leads" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "company" TEXT,
    "jobTitle" TEXT,
    "customFields" JSONB NOT NULL DEFAULT '{}',
    "emailGenerationStatus" "public"."EmailGenerationStatus" NOT NULL DEFAULT 'PENDING',
    "emailGenerationError" TEXT,
    "generatedSubject" TEXT,
    "generatedBody" TEXT,
    "generatedHtmlBody" TEXT,
    "generatedAt" TIMESTAMP(3),
    "tokensUsed" INTEGER,
    "verificationStatus" "public"."EmailVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verificationResult" JSONB,
    "verificationProcessedAt" TIMESTAMP(3),
    "isValidEmail" BOOLEAN NOT NULL DEFAULT false,
    "verificationSubStatus" TEXT,
    "sendStatus" "public"."EmailSendStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "sendError" TEXT,
    "messageId" TEXT,
    "gmailThreadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_campaign_leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_campaigns_userId_idx" ON "public"."email_campaigns"("userId");

-- CreateIndex
CREATE INDEX "email_campaigns_status_idx" ON "public"."email_campaigns"("status");

-- CreateIndex
CREATE INDEX "email_campaign_leads_campaignId_idx" ON "public"."email_campaign_leads"("campaignId");

-- CreateIndex
CREATE INDEX "email_campaign_leads_email_idx" ON "public"."email_campaign_leads"("email");

-- CreateIndex
CREATE INDEX "email_campaign_leads_verificationStatus_idx" ON "public"."email_campaign_leads"("verificationStatus");

-- CreateIndex
CREATE INDEX "email_campaign_leads_sendStatus_idx" ON "public"."email_campaign_leads"("sendStatus");

-- AddForeignKey
ALTER TABLE "public"."email_campaigns" ADD CONSTRAINT "email_campaigns_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."email_campaigns" ADD CONSTRAINT "email_campaigns_googleSheetId_fkey" FOREIGN KEY ("googleSheetId") REFERENCES "public"."GoogleSheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."email_campaign_leads" ADD CONSTRAINT "email_campaign_leads_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "public"."email_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
