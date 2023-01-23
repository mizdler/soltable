-- CreateTable
CREATE TABLE "TableRecord" (
    "id" SERIAL NOT NULL,
    "table" TEXT NOT NULL,
    "account" TEXT NOT NULL,

    CONSTRAINT "TableRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Checkpoint" (
    "key" TEXT NOT NULL,
    "sig" TEXT,

    CONSTRAINT "Checkpoint_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "TableRecord_table_account_key" ON "TableRecord"("table", "account");
