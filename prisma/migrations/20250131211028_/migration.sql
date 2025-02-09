/*
  Warnings:

  - A unique constraint covering the columns `[listId,address]` on the table `Wallet` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Wallet_address_key";

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_listId_address_key" ON "Wallet"("listId", "address");
