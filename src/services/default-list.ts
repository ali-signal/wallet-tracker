import { PrismaClient, type List } from "@prisma/client";
import { defaultBotId, defaultListId } from "../settings/default";

/**
 * Create a default list
 * the default list is created when the application starts
 * parent of all single wallets
 * used to inherit configurations
 * should be hidden from the user
 *
 * creates the default bot too
 * id: default-bot
 * token is in env variable
 *
 * @param {PrismaClient} prisma
 *
 * @returns {List} list - Default list
 */
async function createDefaultList(prisma: PrismaClient): Promise<List> {
  const defaultBotToken = process.env.DEFAULT_BOT_TOKEN;

  if (!defaultBotToken) {
    throw new Error("env variable 'DEFAULT_BOT_TOKEN' is missing...");
  }

  await prisma.bot.upsert({
    where: { id: defaultBotId },
    update: {},
    create: {
      id: defaultBotId,
      token: defaultBotToken,
    },
  });

  const list = await prisma.list.upsert({
    where: { id: defaultListId },
    update: {},
    create: {
      id: defaultListId,
      name: "Default",
      description: "Default List for all wallets...",
      userId: "postgres",
    },
  });

  return list;
}

/**
 * Get the default list
 *
 * @param {PrismaClient} prisma
 *
 * @returns {List} list - Default list
 */
async function getDefaultList(prisma: PrismaClient): Promise<List | null> {
  const list = await prisma.list.findFirst({ where: { id: defaultListId } });
  return list;
}

export { createDefaultList, getDefaultList };
