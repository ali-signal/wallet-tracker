import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { getUserId, hasPermission, hasPermissionOrScope } from "../services/auth";
import { notificationsScope, readNotificationsPermission, writeNotificationsPermission } from "../settings/permissions";
import { defaultListId } from "../settings/default";

const logger = require("pino")({ level: process.env.LOG_LEVEL || "info" });

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/lists
 * Get all lists from the database
 * only read:notifications permission can access this endpoint
 *
 * @returns {List[]} lists - List of list
 */
router.get("/", async (req, res) => {
  try {
    if (!hasPermission(readNotificationsPermission, req.user?.permissions.permissions)) {
      res.status(403).send({ message: "Forbidden" });
      return;
    }

    const lists = await prisma.list.findMany();
    res.json(lists);
  } catch (error) {
    logger.error(error);
    res.status(500).send({ message: "Internal server error" });
  }
});

/**
 * GET /api/lists/active
 * Get all active and public lists from the database
 *
 * @returns {List[]} lists - List of list
 */
router.get("/active", async (req, res) => {
  try {
    const userId = getUserId(req);

    const lists = await prisma.list.findMany({
      where: { active: true, id: { not: defaultListId } },
      include: {
        followers: {
          where: { userId },
          select: { userId: true },
        },
      },
    });

    res.json(
      lists.map((l) => {
        return {
          ...l,
          isFollowing: l.followers.length > 0,
        };
      })
    );
  } catch (error) {
    logger.error(error);
    res.status(500).send({ message: "Internal server error" });
  }
});

/**
 * POST /api/lists
 * Create a new List
 * only premium and pro can access this endpoint
 *
 * @param {string} name - list name
 * @param {string} twitter - list twitter
 * @param {string} description - list description
 *
 * @returns {List} list - Created list
 */
router.post("/", async (req, res) => {
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

    const { name, twitter, description, avatar } = req.body;

    const list = await prisma.list.create({
      data: { name, twitter, description, userId, avatar },
    });

    res.json(list);
  } catch (error) {
    logger.error(error);
    res.status(500).send({ message: "Internal server error" });
  }
});

/**
 * PUT /api/lists/:listId
 * Update a list by id
 * only list owner can access this endpoint
 * only premium and pro can access this endpoint
 *
 * @param {string} listId - List ID
 *
 * @param {string} name - list name
 * @param {string} twitter - list twitter
 * @param {string} description - list description
 *
 * @returns {List} list - Updated list
 */
router.put("/:listId", async (req, res) => {
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

    const listId = req.params.listId;

    // list owner and signal21 team (write:notifications) can update the list
    const ls = await prisma.list.findFirst({
      where: { id: listId },
    });

    if (hasPermission(writeNotificationsPermission, req.user?.permissions.permissions) || ls?.userId === userId) {
      const { name, twitter, description } = req.body;

      const list = await prisma.list.update({
        where: { id: listId },
        data: { name, twitter, description },
      });

      res.json(list);
      return;
    }
    res.status(403).send({ message: "Forbidden" });
  } catch (error) {
    logger.error(error);
    res.status(500).send({ message: "Internal server error" });
  }
});

/**
 * DELETE /api/lists/:listId
 * delete a list by id
 * only signal21 team and list owner can access this endpoint
 *
 * @param {string} listId - List ID
 *
 * @returns {List} list - Deleted list
 */
router.delete("/:listId", async (req, res) => {
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

    const listId = req.params.listId;

    // list owner and signal21 team (write:notifications) can delete the list
    const ls = await prisma.list.findFirst({
      where: { id: listId },
    });

    if (hasPermission(writeNotificationsPermission, req.user?.permissions.permissions) || ls?.userId === userId) {
      const deleted = await prisma.list.delete({
        where: { id: listId },
      });

      res.json(deleted);
      return;
    }
    res.status(403).send({ message: "Forbidden" });
  } catch (error) {
    logger.error(error);
    res.status(500).send({ message: "Internal server error" });
  }
});

/**
 * POST /api/lists/follow
 * Follow a list
 * only premium and pro can access this endpoint
 *
 * @param {string} listId - List ID
 *
 * @returns {ListFollow} follow - Created follow
 */
router.post("/follow", async (req, res) => {
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

    const { listId } = req.body;

    const follow = await prisma.listFollow.create({
      data: { listId, userId },
    });

    // increment list followers count
    await prisma.list.update({
      where: { id: listId },
      data: { followersNumber: { increment: 1 } },
    });

    res.json(follow);
  } catch (error) {
    logger.error(error);
    res.status(500).send({ message: "Internal server error" });
  }
});

/**
 * DELETE /api/lists/unfollow
 * Unfollow a list
 * only premium and pro can access this endpoint
 *
 * @param {string} listId - List ID
 *
 * @returns {List} list - Updated list after unfollow
 */
router.delete("/unfollow/:listId", async (req, res) => {
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

    const listId = req.params.listId;

    await prisma.listFollow.delete({
      where: {
        listId_userId: { listId, userId },
      },
    });

    // decrement list followers count
    const updated = await prisma.list.update({
      where: { id: listId },
      data: { followersNumber: { decrement: 1 } },
    });

    res.json(updated);
  } catch (error) {
    logger.error(error);
    res.status(500).send({ message: "Internal server error" });
  }
});

export { router as listsRouter };
