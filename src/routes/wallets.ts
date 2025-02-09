import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { getUserId, hasPermissionOrScope } from "../services/auth";
import { notificationsScope, writeNotificationsPermission } from "../settings/permissions";
import { getLeastSubbedBot } from "../services/bot";
import { listWalletsMaxNumber } from "../settings/limits";

const logger = require("pino")({ level: process.env.LOG_LEVEL || "info" });

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/wallets/:listId
 * Get all wallets in a list
 *
 * @param {string} listId - list id
 *
 * @returns {Wallet[]} wallets - List of wallet
 */
router.get("/:listId", async (req, res) => {
  try {
    const list = await prisma.list.findFirst({
      where: { id: req.params.listId },
    });

    if (list?.active === false) {
      res.json({ message: "Not found!" }).status(404);
      return;
    }

    const wallets = await prisma.listWallet.findMany({
      where: { listId: req.params.listId },
      include: {
        wallet: {
          include: {
            subscriptions: {
              where: { userId: getUserId(req) },
              select: { plan: true, chatId: true, userId: true },
            },
            aliases: {
              where: { userId: getUserId(req) },
              select: { alias: true },
            },
          },
        },
      },
    });

    res.json({
      list,
      wallets: wallets.map((w) => {
        return {
          ...w.wallet,
          isSubscribed: w.wallet.subscriptions.length > 0,
        };
      }),
    });
  } catch (error) {
    logger.error(error);
    res.status(500).send({ message: "Internal server error" });
  }
});

/**
 * POST /api/wallets/add-to-list
 * Add a wallet to a list
 * only pro and premium can access this endpoint
 *
 * @param {string} walletId - wallet id
 * @param {string?} listId - list id
 *
 * @returns {Wallet} wallet - Created wallet
 */
router.post("/add-to-list", async (req, res) => {
  try {
    if (!hasPermissionOrScope(writeNotificationsPermission, notificationsScope, req)) {
      res.status(403).send({ message: "Forbidden" });
      return;
    }

    const { address, listId } = req.body;

    // a user can add a wallet to a list only if he is the owner of the list
    const ls = await prisma.list.findFirst({
      where: { id: listId, userId: getUserId(req) },
    });

    if (!ls) {
      res.status(403).send({ message: "Forbidden" });
      return;
    }

    // a list can have only 20 wallets
    if (ls.walletsNumber === listWalletsMaxNumber) {
      res.status(403).send({ message: "Max number of wallets in a list reached." });
      return;
    }

    let wallet = await prisma.wallet.findFirst({
      where: { address: address },
    });

    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: { address },
      });
    }

    await prisma.listWallet.create({
      data: { listId, walletId: wallet.id },
    });

    // increase wallets count for the list
    await prisma.list.update({
      where: { id: listId },
      data: { walletsNumber: { increment: 1 } },
    });

    res.json(wallet);
  } catch (error) {
    logger.error(error);
    res.status(500).send({ message: "Internal server error" });
  }
});

/**
 * DELETE /api/wallets/remove-from-list
 * remove a wallet from a list
 * only pro and premium can access this endpoint
 *
 * @param {string} walletId - wallet id
 * @param {string?} listId - list id
 *
 * @returns {List} list - updated list
 */
router.delete("/remove-from-list", async (req, res) => {
  try {
    if (!hasPermissionOrScope(writeNotificationsPermission, notificationsScope, req)) {
      res.status(403).send({ message: "Forbidden" });
      return;
    }

    const { walletId, listId } = req.body;

    // a user can remove a wallet from list only if he is the owner of the list
    const ls = await prisma.list.findFirst({
      where: { id: listId, userId: getUserId(req) },
    });

    if (!ls) {
      res.status(403).send({ message: "Forbidden" });
      return;
    }

    // remove association between wallet and list
    await prisma.listWallet.delete({
      where: { listId_walletId: { listId, walletId } },
    });

    // decrease wallets count for the list
    const updated = await prisma.list.update({
      where: { id: listId },
      data: { walletsNumber: { decrement: 1 } },
    });

    res.json(updated);
  } catch (error) {
    logger.error(error);
    res.status(500).send({ message: "Internal server error" });
  }
});

/**
 * POST /api/wallets/sub/{walletId}
 * Add a new subscription to a wallet
 * only pro and premium can access this endpoint
 *
 * @param {string} plan - subscription plan
 * @param {string} chatId - chat id
 * @param {string} walletId - wallet id
 *
 * @returns {Wallet} wallet - Created wallet
 */
router.post("/sub/:walletId", async (req, res) => {
  try {
    if (!hasPermissionOrScope(writeNotificationsPermission, notificationsScope, req)) {
      res.status(403).send({ message: "Forbidden" });
      return;
    }

    const { plan, chatId } = req.body;

    const leastBotSubbed = await getLeastSubbedBot(prisma);

    // subscribe to wallet
    const subscription = await prisma.subscription.create({
      data: { walletId: req.params.walletId, userId: getUserId(req), plan, chatId, botId: leastBotSubbed!.id },
    });

    // increment subsNumber for the bot
    await prisma.bot.update({
      where: { id: leastBotSubbed?.id },
      data: { subsNumber: { increment: 1 } },
    });

    res.json(subscription);
  } catch (error) {
    logger.error(error);
    res.status(500).send({ message: "Internal server error" });
  }
});

/**
 * DELETE /api/wallets/unsub/{walletId}
 * remove subscription to a wallet
 * only pro and premium can access this endpoint
 *
 * @param {string} walletId - wallet id
 *
 * @returns {Wallet} wallet - Created wallet
 */
router.delete("/unsub/:walletId", async (req, res) => {
  try {
    if (!hasPermissionOrScope(writeNotificationsPermission, notificationsScope, req)) {
      res.status(403).send({ message: "Forbidden" });
      return;
    }

    // unsubscribe to wallet
    const subscription = await prisma.subscription.delete({
      where: {
        userId_walletId: {
          userId: getUserId(req),
          walletId: req.params.walletId,
        },
      },
    });

    // decrement subsNumber for the bot
    await prisma.bot.update({
      where: { id: subscription.botId },
      data: { subsNumber: { decrement: 1 } },
    });

    res.json(subscription);
  } catch (error) {
    logger.error(error);
    res.status(500).send({ message: "Internal server error" });
  }
});

/**
 * PUT /api/wallets/alias/{walletId}
 * Add alias to a wallet
 * only pro and premium can access this endpoint
 *
 * @param {string} walletId - wallet Id
 * @param {string} alias - wallet alias
 *
 * @returns {Wallet} wallet - updated wallet
 */
router.put("/alias/:walletId", async (req, res) => {
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

    const { alias } = req.body;
    const walletId = req.params.walletId;

    const aliasResult = await prisma.userWalletAlias.upsert({
      where: { userId_walletId: { userId, walletId } },
      update: { alias },
      create: { walletId, alias, userId },
    });

    res.json(aliasResult);
  } catch (error) {
    logger.error(error);
    res.status(500).send({ message: "Internal server error" });
  }
});

export { router as walletsRouter };
