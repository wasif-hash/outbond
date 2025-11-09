-- CreateEnum
CREATE TYPE "public"."ReplyDisposition" AS ENUM ('PENDING', 'POSITIVE', 'NEUTRAL', 'NOT_INTERESTED', 'UNSUB', 'BOUNCED');

-- CreateTable
CREATE TABLE "public"."EmailReply" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailSendJobId" TEXT,
    "leadId" TEXT,
    "campaignId" TEXT,
    "gmailMessageId" TEXT,
    "gmailThreadId" TEXT,
    "leadEmail" TEXT NOT NULL,
    "leadFirstName" TEXT,
    "leadLastName" TEXT,
    "leadCompany" TEXT,
    "subject" TEXT,
    "snippet" TEXT,
    "bodyPlain" TEXT,
    "bodyHtml" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disposition" "public"."ReplyDisposition" NOT NULL DEFAULT 'PENDING',
    "summary" TEXT,
    "classificationModel" TEXT,
    "classificationConfidence" DOUBLE PRECISION,
    "classificationMetadata" JSONB,
    "classifiedAt" TIMESTAMP(3),
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailReply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailReply_userId_receivedAt_idx" ON "public"."EmailReply"("userId", "receivedAt");

-- CreateIndex
CREATE INDEX "EmailReply_userId_disposition_idx" ON "public"."EmailReply"("userId", "disposition");

-- CreateIndex
CREATE INDEX "EmailReply_campaignId_idx" ON "public"."EmailReply"("campaignId");

-- CreateIndex
CREATE INDEX "EmailReply_emailSendJobId_idx" ON "public"."EmailReply"("emailSendJobId");

-- CreateIndex
CREATE INDEX "EmailReply_leadId_idx" ON "public"."EmailReply"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailReply_userId_gmailMessageId_key" ON "public"."EmailReply"("userId", "gmailMessageId");

-- AddForeignKey
ALTER TABLE "public"."EmailReply" ADD CONSTRAINT "EmailReply_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailReply" ADD CONSTRAINT "EmailReply_emailSendJobId_fkey" FOREIGN KEY ("emailSendJobId") REFERENCES "public"."EmailSendJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailReply" ADD CONSTRAINT "EmailReply_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailReply" ADD CONSTRAINT "EmailReply_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "public"."Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
