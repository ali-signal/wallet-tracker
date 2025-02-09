import { Request } from "express";

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
