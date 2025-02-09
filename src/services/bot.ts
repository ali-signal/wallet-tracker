import { PrismaClient } from "@prisma/client";

export async function getLeastSubbedBot(prisma: PrismaClient) {
  return await prisma.bot.findFirst({
    orderBy: { subsNumber: "asc" },
  });
}
