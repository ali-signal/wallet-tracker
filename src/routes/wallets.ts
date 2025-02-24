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
 * GET /api/wallets/:address
 * Get wallet by address
 *
 * @param {string} address - wallet address
 *
 * @returns {Wallet} wallets - wallet
 */
router.get("/address/:address", async (req, res) => {
  try {
    const userId = getUserId(req);

    const wallet = await prisma.wallet.findFirst({
      where: { address: req.params.address },
      include: {
        subscriptions: {
          where: { userId: getUserId(req) },
          select: { plan: true, chatId: true, userId: true },
        },
        aliases: {
          where: {
            userId: userId,
          },
        },
      },
    });

    res.json({
      ...wallet,
      isSubscribed: wallet?.subscriptions ? wallet?.subscriptions.length > 0 : false,
      alias: wallet?.aliases.length ? wallet.aliases[0].alias : null,
    });
  } catch (error) {
    logger.error(error);
    res.status(500).send({ message: "Internal server error" });
  }
});

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
    const userId = getUserId(req);

    const list = await prisma.list.findFirst({
      where: { id: req.params.listId },
      include: {
        followers: {
          where: { userId },
          select: { userId: true },
        },
      },
    });

    if (list?.active === false) {
      res.json({ message: "Not found!" }).status(404);
      return;
    }

    if (list?.public === false && list.userId !== userId) {
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
      list: {
        ...list,
        isFollowing: list?.followers?.length ?? 0 > 0,
        isOwner: list?.userId === getUserId(req),
      },
      wallets: wallets.map((w) => {
        return {
          ...w.wallet,
          isSubscribed: w.wallet.subscriptions.length > 0,
          alias: w?.wallet.aliases.length ? w.wallet.aliases[0].alias : null,
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
 * @param {string[]} wallets - wallets ids
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

    const { wallets, listId } = req.body;

    // a user can remove a wallet from list only if he is the owner of the list
    const ls = await prisma.list.findFirst({
      where: { id: listId, userId: getUserId(req) },
    });

    if (!ls) {
      res.status(403).send({ message: "Forbidden" });
      return;
    }

    wallets.forEach(async (w: string) => {
      // remove association between wallet and list
      await prisma.listWallet.delete({
        where: { listId_walletId: { listId, walletId: w } },
      });
    });

    // decrease wallets count for the list
    const updated = await prisma.list.update({
      where: { id: listId },
      data: { walletsNumber: { decrement: wallets.length } },
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
 * PUT /api/wallets/alias/{walletAddress}
 * Add alias to a wallet
 * only pro and premium can access this endpoint
 *
 * @param {string} walletAddress - wallet Id
 * @param {string} alias - wallet alias
 *
 * @returns {Wallet} wallet - updated wallet
 */
router.put("/alias/:walletAddress", async (req, res) => {
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
    const walletAddress = req.params.walletAddress;

    let wallet = await prisma.wallet.findUnique({
      where: { address: walletAddress },
    });

    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: { address: walletAddress },
      });
    }

    if (!wallet) {
      res.status(404).json({ error: "Wallet ID not found" });
      return;
    }

    const aliasInDb = await prisma.userWalletAlias.findFirst({
      where: { userId, walletId: wallet.id },
    });

    const aliasResult = await prisma.userWalletAlias.upsert({
      where: { id: aliasInDb ? aliasInDb.id : "" },
      create: { alias, walletId: wallet.id, userId },
      update: { alias },
    });

    res.json(aliasResult);
  } catch (error) {
    logger.error(error);
    res.status(500).send({ message: "Internal server error" });
  }
});

export { router as walletsRouter };
