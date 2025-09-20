-- CreateTable
CREATE TABLE "public"."GoogleOAuthToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL,
    "tokenType" TEXT NOT NULL,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoogleOAuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GoogleSheet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "spreadsheetId" TEXT NOT NULL,
    "spreadsheetUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sheetId" INTEGER,
    "sheetTitle" TEXT,
    "range" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleSheet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GoogleOAuthToken_userId_idx" ON "public"."GoogleOAuthToken"("userId");

-- CreateIndex
CREATE INDEX "GoogleSheet_userId_isDefault_idx" ON "public"."GoogleSheet"("userId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleSheet_userId_spreadsheetId_key" ON "public"."GoogleSheet"("userId", "spreadsheetId");

-- AddForeignKey
ALTER TABLE "public"."GoogleOAuthToken" ADD CONSTRAINT "GoogleOAuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GoogleSheet" ADD CONSTRAINT "GoogleSheet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
