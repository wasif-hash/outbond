/*
  Warnings:

  - You are about to drop the column `isActive` on the `GoogleSheet` table. All the data in the column will be lost.
  - You are about to drop the column `lastSyncAt` on the `GoogleSheet` table. All the data in the column will be lost.
  - You are about to drop the column `url` on the `GoogleSheet` table. All the data in the column will be lost.
  - Added the required column `tokenType` to the `GoogleOAuthToken` table without a default value. This is not possible if the table is not empty.
  - Added the required column `spreadsheetUrl` to the `GoogleSheet` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."GoogleOAuthToken" ADD COLUMN     "tokenType" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."GoogleSheet" DROP COLUMN "isActive",
DROP COLUMN "lastSyncAt",
DROP COLUMN "url",
ADD COLUMN     "lastUsedAt" TIMESTAMP(3),
ADD COLUMN     "range" TEXT,
ADD COLUMN     "sheetId" INTEGER,
ADD COLUMN     "sheetTitle" TEXT,
ADD COLUMN     "spreadsheetUrl" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "invitedAt" TIMESTAMP(3),
ADD COLUMN     "isInvited" BOOLEAN NOT NULL DEFAULT false;
