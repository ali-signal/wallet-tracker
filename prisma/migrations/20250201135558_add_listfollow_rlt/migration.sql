/*
  Warnings:

  - You are about to drop the column `createdAt` on the `UserWalletAlias` table. All the data in the column will be lost.
  - You are about to drop the column `listId` on the `Wallet` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[address]` on the table `Wallet` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Wallet" DROP CONSTRAINT "Wallet_listId_fkey";

-- DropIndex
DROP INDEX "Bot_token_key";

-- DropIndex
DROP INDEX "ListFollow_listId_userId_key";

-- DropIndex
DROP INDEX "UserWalletAlias_userId_walletId_key";

-- DropIndex
DROP INDEX "Wallet_listId_address_key";

-- AlterTable
ALTER TABLE "Bot" ALTER COLUMN "listsNumber" DROP DEFAULT,
ALTER COLUMN "active" DROP DEFAULT;

-- AlterTable
ALTER TABLE "List" ALTER COLUMN "walletsNumber" DROP DEFAULT,
ALTER COLUMN "followersNumber" DROP DEFAULT,
ALTER COLUMN "active" DROP DEFAULT;

-- AlterTable
ALTER TABLE "UserWalletAlias" DROP COLUMN "createdAt";

-- AlterTable
ALTER TABLE "Wallet" DROP COLUMN "listId";

-- CreateTable
CREATE TABLE "ListWallet" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,

    CONSTRAINT "ListWallet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_address_key" ON "Wallet"("address");

-- AddForeignKey
ALTER TABLE "ListWallet" ADD CONSTRAINT "ListWallet_listId_fkey" FOREIGN KEY ("listId") REFERENCES "List"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListWallet" ADD CONSTRAINT "ListWallet_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
