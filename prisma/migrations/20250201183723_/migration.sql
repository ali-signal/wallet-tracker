/*
  Warnings:

  - A unique constraint covering the columns `[listId,walletId]` on the table `ListWallet` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ListWallet_listId_walletId_key" ON "ListWallet"("listId", "walletId");
