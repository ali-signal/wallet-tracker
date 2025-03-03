import { AccessToken, PrismaClient } from "@prisma/client";
import { Request } from "express";
import { defaultAccessTokenId } from "../settings/default";

const logger = require("pino")({ level: process.env.LOG_LEVEL || "info" });

interface Auth0Token {
  access_token: string;
  scope: string;
  expires_in: number;
  token_type: string;
}

export function hasPermission(perm: string, permissions?: string[]): boolean {
  if (permissions === undefined || permissions === null || permissions.length === 0) {
    return false;
  }

  return permissions.includes(perm);
}

export function hasScope(scope: string, scopes?: Record<string, boolean>): boolean {
  if (scopes === undefined || scopes === null || Object.keys(scopes).length === 0) {
    return false;
  }

  return scopes[scope] === true;
}

export function hasPermissionOrScope(perm: string, scope: string, req: Request): boolean {
  const permissions = req.user?.permissions.permissions;
  const scopes = req.user?.scopes;

  return hasPermission(perm, permissions) || hasScope(scope, scopes);
}

export function getUserId(req: Request): string {
  const _id = req.user?.info?.sub;
  if (_id) return _id;

  const _walletAddress = req.user?.info?.id;
  if (_walletAddress) return _walletAddress;

  return "";
}

export class AuthorizeServer {
  prisma: PrismaClient | undefined;
  token: string | undefined;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async init() {
    const token = await this.getSavedAccessToken();

    const now = new Date();

    if (token === undefined || new Date() >= token.expiresAt) {
      // call auth0 to get and save access token
      const response = await this.getAuth0AccessToken();

      if (!response) return;

      // set this.token
      this.token = response.access_token;

      this.saveAccessToken(response.access_token, new Date(now.getTime() + response.expires_in * 1000));
      return;
    }

    this.token = token.token;
  }

  async getSavedAccessToken(): Promise<AccessToken | undefined> {
    if (!this.prisma) return Promise.resolve(undefined);

    try {
      const response = await this.prisma.accessToken.findFirst({ where: { id: defaultAccessTokenId } });

      if (!response) {
        return;
      }

      return response;
    } catch (e) {
      if (e instanceof Error) logger.info(e.message);
      return Promise.resolve(undefined);
    }
  }

  async saveAccessToken(token: string, expiresAt: Date) {
    if (!this.prisma) return Promise.resolve(undefined);

    try {
      const response = await this.prisma.accessToken.upsert({
        where: { id: defaultAccessTokenId },
        create: { id: defaultAccessTokenId, token, expiresAt },
        update: { id: defaultAccessTokenId, token, expiresAt },
      });

      return response;
    } catch (e) {
      if (e instanceof Error) logger.info(e.message);
      return Promise.resolve(undefined);
    }
  }

  async getAuth0AccessToken(): Promise<Auth0Token | undefined> {
    try {
      const client_id = process.env.AUTH0_CLIENT_ID;
      const audience = process.env.AUTH0_AUDIENCE;
      const client_secret = process.env.AUTH0_CLIENT_SECRET;
      const grant_type = "client_credentials";

      const response = await fetch("https://dev-1pv4n4bz3i3wj2lr.us.auth0.com/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ grant_type, client_id, client_secret, audience }),
      });

      logger.info(`Getting Access Token from auth0: ${response.statusText}`);

      if (response.ok) {
        const data = await response.json();

        return {
          access_token: data.access_token,
          expires_in: data.expires_in,
          scope: data.scope,
          token_type: data.token_type,
        };
      }

      return;
    } catch (e) {
      logger.info(`Error Access Token from auth0: ${e}`);

      return;
    }
  }
}
