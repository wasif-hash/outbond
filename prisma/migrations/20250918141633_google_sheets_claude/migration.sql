/*
  Warnings:

  - You are about to drop the column `installedAt` on the `GoogleOAuthToken` table. All the data in the column will be lost.
  - You are about to drop the column `tokenType` on the `GoogleOAuthToken` table. All the data in the column will be lost.
  - You are about to drop the column `isDefault` on the `GoogleSheet` table. All the data in the column will be lost.
  - You are about to drop the column `range` on the `GoogleSheet` table. All the data in the column will be lost.
  - You are about to drop the column `sheetId` on the `GoogleSheet` table. All the data in the column will be lost.
  - You are about to drop the column `sheetTitle` on the `GoogleSheet` table. All the data in the column will be lost.
  - You are about to drop the column `spreadsheetUrl` on the `GoogleSheet` table. All the data in the column will be lost.
  - You are about to drop the column `invitedAt` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `isInvited` on the `users` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId]` on the table `GoogleOAuthToken` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `GoogleOAuthToken` table without a default value. This is not possible if the table is not empty.
  - Added the required column `url` to the `GoogleSheet` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."GoogleSheet_userId_isDefault_idx";

-- AlterTable
ALTER TABLE "public"."GoogleOAuthToken" DROP COLUMN "installedAt",
DROP COLUMN "tokenType",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "public"."GoogleSheet" DROP COLUMN "isDefault",
DROP COLUMN "range",
DROP COLUMN "sheetId",
DROP COLUMN "sheetTitle",
DROP COLUMN "spreadsheetUrl",
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastSyncAt" TIMESTAMP(3),
ADD COLUMN     "url" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."users" DROP COLUMN "invitedAt",
DROP COLUMN "isInvited";

-- CreateIndex
CREATE UNIQUE INDEX "GoogleOAuthToken_userId_key" ON "public"."GoogleOAuthToken"("userId");

-- CreateIndex
CREATE INDEX "GoogleSheet_userId_idx" ON "public"."GoogleSheet"("userId");
