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

dotenv.config();

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
