/*
  Warnings:

  - You are about to drop the `ListFollow` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ListFollow" DROP CONSTRAINT "ListFollow_listId_fkey";

-- DropTable
DROP TABLE "ListFollow";

-- CreateTable
CREATE TABLE "Follow" (
    "id" TEXT NOT NULL,
    "listId" TEXT,
    "walletId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_listId_fkey" FOREIGN KEY ("listId") REFERENCES "List"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
