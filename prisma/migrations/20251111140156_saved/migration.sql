-- CreateEnum
CREATE TYPE "public"."SavedSnippetType" AS ENUM ('PROMPT', 'SIGNATURE');

-- CreateTable
CREATE TABLE "public"."SavedSnippet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."SavedSnippetType" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedSnippet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedSnippet_userId_type_idx" ON "public"."SavedSnippet"("userId", "type");

-- AddForeignKey
ALTER TABLE "public"."SavedSnippet" ADD CONSTRAINT "SavedSnippet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
