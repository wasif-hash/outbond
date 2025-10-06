-- CreateEnum
CREATE TYPE "public"."EmailSendStatus" AS ENUM ('PENDING', 'QUEUED', 'SENDING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "public"."GmailAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailAddress" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL,
    "tokenType" TEXT NOT NULL,
    "historyId" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmailAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmailSendJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campaignId" TEXT,
    "gmailAccountId" TEXT NOT NULL,
    "leadEmail" TEXT NOT NULL,
    "leadFirstName" TEXT,
    "leadLastName" TEXT,
    "leadCompany" TEXT,
    "leadSummary" TEXT,
    "sheetRowRef" TEXT,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "bodyText" TEXT,
    "status" "public"."EmailSendStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "scheduledAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailSendJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GmailAccount_userId_key" ON "public"."GmailAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GmailAccount_emailAddress_key" ON "public"."GmailAccount"("emailAddress");

-- CreateIndex
CREATE INDEX "EmailSendJob_userId_idx" ON "public"."EmailSendJob"("userId");

-- CreateIndex
CREATE INDEX "EmailSendJob_campaignId_idx" ON "public"."EmailSendJob"("campaignId");

-- CreateIndex
CREATE INDEX "EmailSendJob_gmailAccountId_idx" ON "public"."EmailSendJob"("gmailAccountId");

-- CreateIndex
CREATE INDEX "EmailSendJob_status_idx" ON "public"."EmailSendJob"("status");

-- AddForeignKey
ALTER TABLE "public"."GmailAccount" ADD CONSTRAINT "GmailAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailSendJob" ADD CONSTRAINT "EmailSendJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailSendJob" ADD CONSTRAINT "EmailSendJob_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "public"."Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailSendJob" ADD CONSTRAINT "EmailSendJob_gmailAccountId_fkey" FOREIGN KEY ("gmailAccountId") REFERENCES "public"."GmailAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
