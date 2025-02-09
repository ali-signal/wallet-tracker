import { Request } from "express";

declare module "express-serve-static-core" {
  interface Request {
    user?: {
      info: {
        id?: string;
        sub?: string;
        nickname?: string;
        name?: string;
        picture?: string;
        updated_at?: string;
        email?: string;
        email_verified?: boolean;
      };

      scopes: Record<string, boolean>;

      permissions: {
        permissions: string[];
      };
    };
  }
}
