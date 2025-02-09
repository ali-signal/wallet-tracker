import { PrismaClient } from "@prisma/client";
import { Telegraf } from "telegraf";

const logger = require("pino")({ level: process.env.LOG_LEVEL || "info" });

export class TelegramService {
  prismaClient: PrismaClient;
  telegraphs: Telegraf[] = [];

  constructor(client: PrismaClient) {
    this.prismaClient = client;
  }

  async initTelegramBots() {
    if (this.telegraphs.length > 0) return;

    const activeBots = await this.prismaClient.bot.findMany({ where: { active: true } });

    for (let bot of activeBots) {
      const telegramBot = new Telegraf(bot.token);

      this.telegraphs.push(telegramBot);

      telegramBot.start((ctx) => ctx.reply("Welcome to the Telegram telegramBot!"));

      telegramBot.help((ctx) => ctx.reply("Send /start to begin."));

      telegramBot.launch().then(() => {
        logger.info(`Telegram bot ${bot.id} is running...`);
      });
    }
  }

  cleanBotsOnExit() {
    process.once("SIGINT", () => this.telegraphs.forEach((bot) => bot.stop("SIGINT")));
    process.once("SIGTERM", () => this.telegraphs.forEach((bot) => bot.stop("SIGTERM")));
  }
}
