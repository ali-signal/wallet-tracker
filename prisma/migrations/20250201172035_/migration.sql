/*
  Warnings:

  - You are about to drop the column `listsNumber` on the `Bot` table. All the data in the column will be lost.
  - You are about to drop the column `botId` on the `List` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,walletId]` on the table `Subscription` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `botId` to the `Subscription` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "List" DROP CONSTRAINT "List_botId_fkey";

-- AlterTable
ALTER TABLE "Bot" DROP COLUMN "listsNumber",
ADD COLUMN     "subsNumber" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "List" DROP COLUMN "botId";

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "botId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_walletId_key" ON "Subscription"("userId", "walletId");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
