/*
  Warnings:

  - You are about to drop the column `phone` on the `Lead` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Campaign" ADD COLUMN     "excludeDomains" TEXT,
ADD COLUMN     "includeDomains" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'apollo',
ALTER COLUMN "pageSize" SET DEFAULT 25;

-- AlterTable
ALTER TABLE "public"."Lead" DROP COLUMN "phone",
ADD COLUMN     "companyLinkedinUrl" TEXT,
ADD COLUMN     "companySize" TEXT,
ADD COLUMN     "domain" TEXT,
ADD COLUMN     "summary" TEXT,
ALTER COLUMN "source" SET DEFAULT 'apollo';
