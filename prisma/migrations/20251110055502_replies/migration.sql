/*
  Warnings:

  - The values [PENDING] on the enum `ReplyDisposition` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `classificationMetadata` on the `EmailReply` table. All the data in the column will be lost.
  - You are about to drop the column `leadCompany` on the `EmailReply` table. All the data in the column will be lost.
  - You are about to drop the column `leadFirstName` on the `EmailReply` table. All the data in the column will be lost.
  - You are about to drop the column `leadLastName` on the `EmailReply` table. All the data in the column will be lost.
  - You are about to drop the column `rawPayload` on the `EmailReply` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."ReplyDisposition_new" AS ENUM ('NO_RESPONSE', 'POSITIVE', 'NEUTRAL', 'NOT_INTERESTED', 'UNSUB', 'BOUNCED');
ALTER TABLE "public"."EmailReply" ALTER COLUMN "disposition" DROP DEFAULT;
ALTER TABLE "public"."EmailReply" ALTER COLUMN "disposition" TYPE "public"."ReplyDisposition_new" USING ("disposition"::text::"public"."ReplyDisposition_new");
ALTER TYPE "public"."ReplyDisposition" RENAME TO "ReplyDisposition_old";
ALTER TYPE "public"."ReplyDisposition_new" RENAME TO "ReplyDisposition";
DROP TYPE "public"."ReplyDisposition_old";
ALTER TABLE "public"."EmailReply" ALTER COLUMN "disposition" SET DEFAULT 'NO_RESPONSE';
COMMIT;

-- AlterTable
ALTER TABLE "public"."EmailReply" DROP COLUMN "classificationMetadata",
DROP COLUMN "leadCompany",
DROP COLUMN "leadFirstName",
DROP COLUMN "leadLastName",
DROP COLUMN "rawPayload",
ALTER COLUMN "disposition" SET DEFAULT 'NO_RESPONSE';
