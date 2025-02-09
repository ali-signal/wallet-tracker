/*
  Warnings:

  - A unique constraint covering the columns `[listId,userId]` on the table `ListFollow` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ListFollow_listId_userId_key" ON "ListFollow"("listId", "userId");
