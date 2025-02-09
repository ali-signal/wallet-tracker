/*
  Warnings:

  - A unique constraint covering the columns `[userId,walletId]` on the table `UserWalletAlias` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "UserWalletAlias_userId_walletId_key" ON "UserWalletAlias"("userId", "walletId");
