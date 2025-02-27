import express from "express";
import dotenv from "dotenv";
import customMiddleware from "./middleware";
import { botsRouter } from "./routes/bots";
import { listsRouter } from "./routes/lists";
import { TelegramService } from "./services/telegram";
import { PrismaClient } from "@prisma/client";
import { createDefaultList } from "./services/default-list";
import { PORT } from "./settings/port";
import { walletsRouter } from "./routes/wallets";
import { chainhookRouter } from "./chainhook";
import cors from "cors";
import { allowedOrigins } from "./settings/cors";
import { getUserId, hasPermissionOrScope } from "./services/auth";
import { notificationsScope, writeNotificationsPermission } from "./settings/permissions";
import { Feed } from "./services/feed";

dotenv.config();

const logger = require("pino")({ level: process.env.LOG_LEVEL || "info" });

const prisma = new PrismaClient();

const app = express();

// middleware
app.use(express.json());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(customMiddleware);

// routes
app.use("/api/bots", botsRouter);
app.use("/api/lists", listsRouter);
app.use("/api/wallets", walletsRouter);
app.use("/api/chainhook", chainhookRouter);

app.post("/api/feed", async (req, res) => {
  try {
    if (!hasPermissionOrScope(writeNotificationsPermission, notificationsScope, req)) {
      res.status(403).send({ message: "Forbidden" });
      return;
    }

    const userId = getUserId(req);

    if (!userId) {
      res.status(403).send({ message: "Forbidden" });
      return;
    }

    const { addresses } = req.body;
    const { offset } = req.query;

    let feed: Feed | null = new Feed(req, addresses);
    feed.setOffset(offset as string);

    const data = await feed.getTxsOneQuery();

    // grabage collection (remove feed)
    feed = null;

    res.json(data);
  } catch (error) {
    logger.error(error);
    res.status(500).send({ message: "Internal server error" });
  }
});

app.get("/api/feed/mine", async (req, res) => {
  try {
    if (!hasPermissionOrScope(writeNotificationsPermission, notificationsScope, req)) {
      res.status(403).send({ message: "Forbidden" });
      return;
    }

    const userId = getUserId(req);

    if (!userId) {
      res.status(403).send({ message: "Forbidden" });
      return;
    }

    const { offset } = req.query;

    const followedLists = await prisma.list.findMany({
      where: { followers: { some: { userId } } },
      include: {
        wallets: {
          include: {
            wallet: true,
          },
        },
      },
    });

    const followedWallets = await prisma.wallet.findMany({
      where: { follows: { some: { userId } } },
    });

    let mergedWalletAddresses = [
      ...followedLists
        .map((l) => l.wallets)
        .map((merged) => merged.map((w) => w.wallet.address))
        .flat(),
      ...followedWallets.map((w) => w.address),
    ];

    let feed: Feed | null = new Feed(req, mergedWalletAddresses);
    feed.setOffset(offset as string);

    const data = await feed.getTxsOneQuery();

    // grabage collection (remove feed)
    feed = null;

    res.json({ wallets: mergedWalletAddresses, txs: data });
  } catch (error) {
    logger.error(error);
    res.status(500).send({ message: "Internal server error" });
  }
});

// health check / status / permissions
if (process.env.NODE_ENV !== "production") {
  app.get("/", (req, res) => {
    res.json(req.user);
  });
}

// initialize the default list and the default bot
(async () => {
  await createDefaultList(prisma);
})();

// start the telegram service and init bot in db
const telegramService = new TelegramService(prisma);

(async () => {
  await telegramService.initTelegramBots();
})();

telegramService.cleanBotsOnExit();

// listen on port
app.listen(PORT, () => {
  console.log(`Express server is running at http://localhost:${PORT}`);
});
