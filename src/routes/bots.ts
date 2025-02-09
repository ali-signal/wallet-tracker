import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { hasPermission, hasPermissionOrScope } from "../services/auth";
import { notificationsScope, readNotificationsPermission, writeNotificationsPermission } from "../settings/permissions";

const logger = require("pino")({ level: process.env.LOG_LEVEL || "info" });

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/bots
 * Get all bots from the database
 * only read:notifications can access this endpoint
 *
 * @returns {Bot[]} bots - List of bots
 */
router.get("/", async (req, res) => {
  try {
    if (!hasPermission(readNotificationsPermission, req.user?.permissions.permissions)) {
      res.status(403).send({ message: "Forbidden" });
      return;
    }

    const bots = await prisma.bot.findMany();
    res.json(bots);
  } catch (error) {
    logger.error(error);
    res.status(500).send({ message: "Internal server error" });
  }
});

/**
 * GET /api/bots/active
 * Get all active bots from the database
 * only pro and premium can access this endpoint
 *
 * @returns {Bot[]} bots - List of bots
 */
router.get("/active", async (req, res) => {
  try {
    if (!hasPermissionOrScope(writeNotificationsPermission, notificationsScope, req)) {
      res.status(403).send({ message: "Forbidden" });
      return;
    }

    const bots = await prisma.bot.findMany({
      where: { active: true },
    });
    res.json(bots);
  } catch (error) {
    logger.error(error);
    res.status(500).send({ message: "Internal server error" });
  }
});

/**
 * POST /api/bots
 * Create a new bot
 * only write:notifications can access this endpoint
 *
 * @param {string} token - Bot token
 *
 * @returns {Bot} bot - Created bot
 */
router.post("/", async (req, res) => {
  try {
    if (!hasPermission(writeNotificationsPermission, req.user?.permissions.permissions)) {
      res.status(403).send({ message: "Forbidden" });
      return;
    }

    const { token } = req.body;

    if (!token) {
      res.status(400).send({ message: "Token is required" });
      return;
    }

    const bot = await prisma.bot.create({
      data: { token },
    });

    res.json(bot);
  } catch (error) {
    logger.error(error);
    res.status(500).send({ message: "Internal server error" });
  }
});

/**
 * DELETE /api/bots/:botId
 * delete a bot by id
 * only write:notifications can access this endpoint
 *
 * @param {string} botId - Bot ID
 *
 * @returns {Bot} bot - Deleted bot
 */
router.delete("/:botId", async (req, res) => {
  try {
    if (!hasPermission(writeNotificationsPermission, req.user?.permissions.permissions)) {
      res.status(403).send({ message: "Forbidden" });
      return;
    }

    const botId = req.params.botId;

    const deleted = await prisma.bot.delete({
      where: { id: botId },
    });

    res.json(deleted);
  } catch (error) {
    logger.error(error);
    res.status(500).send({ message: "Internal server error" });
  }
});

export { router as botsRouter };
