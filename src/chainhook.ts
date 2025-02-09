import { PrismaClient } from "@prisma/client";
import { Router } from "express";

const logger = require("pino")({ level: process.env.LOG_LEVEL || "info" });

const router = Router();
const prisma = new PrismaClient();

// webhook the chainhook can post to
router.post("/", (req, res) => {
  logger.info("Chainhook received");
  logger.info(JSON.stringify(req.body));
  res.send("ok");
});

// add predicate file

export { router as chainhookRouter };
