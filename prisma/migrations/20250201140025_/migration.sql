-- AlterTable
ALTER TABLE "Bot" ALTER COLUMN "listsNumber" SET DEFAULT 0,
ALTER COLUMN "active" SET DEFAULT true;

-- AlterTable
ALTER TABLE "List" ALTER COLUMN "walletsNumber" SET DEFAULT 0,
ALTER COLUMN "followersNumber" SET DEFAULT 0,
ALTER COLUMN "active" SET DEFAULT true;
