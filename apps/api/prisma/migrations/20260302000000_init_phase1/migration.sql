-- Create enums
CREATE TYPE "ExpenseSource" AS ENUM ('VOICE', 'RECEIPT', 'MANUAL');
CREATE TYPE "PaymentMethodType" AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'E_WALLET', 'TNG', 'GRABPAY', 'SHOPEEPAY', 'DUITNOW', 'OTHER');
CREATE TYPE "CurrencyCode" AS ENUM ('MYR', 'SGD', 'USD');
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- Create tables
CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "supabaseUserId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "displayName" TEXT,
  "locale" TEXT NOT NULL DEFAULT 'en-MY',
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Kuala_Lumpur',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Area" (
  "id" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL DEFAULT 'MY',
  "city" TEXT NOT NULL,
  "district" TEXT,
  "name" TEXT NOT NULL,
  "latitude" DECIMAL(9,6),
  "longitude" DECIMAL(9,6),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Store" (
  "id" TEXT NOT NULL,
  "areaId" TEXT,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "addressLine" TEXT,
  "latitude" DECIMAL(9,6),
  "longitude" DECIMAL(9,6),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Expense" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "source" "ExpenseSource" NOT NULL,
  "currency" "CurrencyCode" NOT NULL DEFAULT 'MYR',
  "totalAmount" DECIMAL(12,2) NOT NULL,
  "merchantText" TEXT,
  "storeId" TEXT,
  "areaId" TEXT,
  "paymentMethod" "PaymentMethodType",
  "transactionAt" TIMESTAMP(3) NOT NULL,
  "note" TEXT,
  "confidence" DECIMAL(5,4),
  "rawPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Receipt" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expenseId" TEXT,
  "sourceFileUrl" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "ocrStatus" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
  "ocrRaw" JSONB,
  "parsedPayload" JSONB,
  "confidence" DECIMAL(5,4),
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExpenseLineItem" (
  "id" TEXT NOT NULL,
  "expenseId" TEXT NOT NULL,
  "receiptId" TEXT,
  "descriptionRaw" TEXT NOT NULL,
  "quantity" DECIMAL(12,4),
  "unitRaw" TEXT,
  "totalPrice" DECIMAL(12,2) NOT NULL,
  "currency" "CurrencyCode" NOT NULL DEFAULT 'MYR',
  "confidence" DECIMAL(5,4),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExpenseLineItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MonthlyReport" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "cashIn" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "cashOut" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "netCashFlow" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "categoryBreakdown" JSONB,
  "insights" JSONB,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MonthlyReport_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "User_supabaseUserId_key" ON "User"("supabaseUserId");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Area_city_district_name_key" ON "Area"("city", "district", "name");
CREATE UNIQUE INDEX "Store_normalizedName_areaId_key" ON "Store"("normalizedName", "areaId");
CREATE UNIQUE INDEX "Receipt_expenseId_key" ON "Receipt"("expenseId");
CREATE UNIQUE INDEX "MonthlyReport_userId_year_month_key" ON "MonthlyReport"("userId", "year", "month");

-- Secondary indexes
CREATE INDEX "Area_city_district_idx" ON "Area"("city", "district");
CREATE INDEX "Store_areaId_normalizedName_idx" ON "Store"("areaId", "normalizedName");
CREATE INDEX "Receipt_userId_capturedAt_idx" ON "Receipt"("userId", "capturedAt");
CREATE INDEX "Expense_userId_transactionAt_idx" ON "Expense"("userId", "transactionAt");
CREATE INDEX "Expense_storeId_transactionAt_idx" ON "Expense"("storeId", "transactionAt");
CREATE INDEX "ExpenseLineItem_expenseId_idx" ON "ExpenseLineItem"("expenseId");
CREATE INDEX "ExpenseLineItem_receiptId_idx" ON "ExpenseLineItem"("receiptId");
CREATE INDEX "MonthlyReport_userId_year_month_idx" ON "MonthlyReport"("userId", "year", "month");

-- Foreign keys
ALTER TABLE "Store"
  ADD CONSTRAINT "Store_areaId_fkey"
  FOREIGN KEY ("areaId") REFERENCES "Area"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_areaId_fkey"
  FOREIGN KEY ("areaId") REFERENCES "Area"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Receipt"
  ADD CONSTRAINT "Receipt_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Receipt"
  ADD CONSTRAINT "Receipt_expenseId_fkey"
  FOREIGN KEY ("expenseId") REFERENCES "Expense"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ExpenseLineItem"
  ADD CONSTRAINT "ExpenseLineItem_expenseId_fkey"
  FOREIGN KEY ("expenseId") REFERENCES "Expense"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExpenseLineItem"
  ADD CONSTRAINT "ExpenseLineItem_receiptId_fkey"
  FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MonthlyReport"
  ADD CONSTRAINT "MonthlyReport_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
