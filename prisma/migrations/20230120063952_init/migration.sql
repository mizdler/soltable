-- CreateTable
CREATE TABLE "TableRecord" (
    "id" SERIAL NOT NULL,
    "table" TEXT NOT NULL,
    "account" TEXT NOT NULL,

    CONSTRAINT "TableRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TableRecord_table_account_key" ON "TableRecord"("table", "account");
