/*
  Warnings:

  - You are about to drop the `email_campaign_leads` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `email_campaigns` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."email_campaign_leads" DROP CONSTRAINT "email_campaign_leads_campaignId_fkey";

-- DropForeignKey
ALTER TABLE "public"."email_campaigns" DROP CONSTRAINT "email_campaigns_googleSheetId_fkey";

-- DropForeignKey
ALTER TABLE "public"."email_campaigns" DROP CONSTRAINT "email_campaigns_userId_fkey";

-- DropTable
DROP TABLE "public"."email_campaign_leads";

-- DropTable
DROP TABLE "public"."email_campaigns";

-- DropEnum
DROP TYPE "public"."EmailCampaignStatus";

-- DropEnum
DROP TYPE "public"."EmailGenerationStatus";

-- DropEnum
DROP TYPE "public"."EmailSendStatus";

-- DropEnum
DROP TYPE "public"."EmailVerificationStatus";
