import { Request, Response, NextFunction } from "express";

const customMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const frontendServer = process.env.FRONTEND_SERVER_URL;

    if (!frontendServer) {
      throw new Error("env variable 'FRONTEND_SERVER_URL' is missing.");
    }

    const headers: HeadersInit = {};

    if (req.headers["authorization"]) {
      headers["Authorization"] = req.headers["authorization"];
    }

    if (req.headers["wallet-address"]) {
      headers["wallet-address"] = req.headers["wallet-address"] as string;
    }

    const response = await fetch(frontendServer.concat("/v2/features"), {
      headers: headers,
    });

    const data = await response.json();

    req.user = data;

    next();
  } catch (error) {
    console.error("Middleware Error:", error);
    // res.status(403).send({ message: "Forbidden" });
    next();
  }
};

export default customMiddleware;
