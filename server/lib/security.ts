import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import { FSRoot } from '../types';

/**
 * ============================================================================
 * NEBULA SECURITY & PATH TRAVERSAL ISOLATION
 * ============================================================================
 * This module enforces strict containment of file operations within allowed
 * roots (NEBULA_ROOTS) to prevent path traversal attacks (e.g. /data/../../etc/passwd).
 */

// Retrieve permitted roots from environment variable NEBULA_ROOTS (comma-separated)
export function getAllowedRoots(): FSRoot[] {
  const envRoots = process.env.NEBULA_ROOTS;
  if (!envRoots || envRoots.trim() === '') {
    // Default fallback in local dev/container: workspace root or /data if exists
    const defaultData = '/data';
    if (fs.existsSync(defaultData)) {
      return [{ name: 'Data (/data)', path: path.resolve(defaultData) }];
    }
    const cwd = process.cwd();
    return [{ name: 'Workspace (' + path.basename(cwd) + ')', path: path.resolve(cwd) }];
  }

  // Suporta separador por vírgula ou dois-pontos (no Linux/Docker)
  const isUnixColon = process.platform !== 'win32' && envRoots.includes(':') && !envRoots.includes(',');
  const list = (isUnixColon ? envRoots.split(':') : envRoots.split(','))
    .map((r) => r.trim())
    .filter(Boolean);

  return list.map((r) => {
    const resolved = path.resolve(r);
    const base = path.basename(resolved) || resolved;
    return {
      name: `${base} (${resolved})`,
      path: resolved,
    };
  });
}

/**
 * Validates that a requested path strictly resides within at least one of the
 * configured NEBULA_ROOTS. Protects against ../ directory traversal tricks.
 */
export function validateAndResolvePath(requestedPath: string | undefined): {
  valid: boolean;
  resolvedPath: string;
  matchedRoot?: FSRoot;
  error?: string;
} {
  if (!requestedPath || typeof requestedPath !== 'string') {
    return { valid: false, resolvedPath: '', error: 'Path is required' };
  }

  // 1. Resolve to absolute path, neutralizing any relative "../" fragments
  const normalized = path.normalize(requestedPath);
  const resolved = path.resolve(normalized);

  const roots = getAllowedRoots();

  // 2. Check containment against permitted roots
  for (const root of roots) {
    const rootPath = root.path;
    // The path is valid if it equals the root exactly OR starts with root + separator
    const rootWithSep = rootPath.endsWith(path.sep) ? rootPath : rootPath + path.sep;
    if (resolved === rootPath || resolved.startsWith(rootWithSep)) {
      return {
        valid: true,
        resolvedPath: resolved,
        matchedRoot: root,
      };
    }
  }

  return {
    valid: false,
    resolvedPath: resolved,
    error: `Permissão negada: Acesso restrito a "${requestedPath}". O caminho está fora dos diretórios autorizados (${roots.map((r) => r.path).join(', ')}).`,
  };
}

/**
 * Token Authentication Middleware
 * Checks for `Authorization: Bearer <TOKEN>` or `?token=<TOKEN>`
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const configuredToken = process.env.NEBULA_TOKEN;

  // In development, if no NEBULA_TOKEN is defined, allow requests with warning
  if (!configuredToken) {
    if (process.env.NODE_ENV === 'production') {
      res.status(500).json({
        error: 'NEBULA_TOKEN is not configured on this server. Production runs require a secure token.',
      });
      return;
    }
    return next();
  }

  // Extract token from header or query param
  const authHeader = req.headers.authorization;
  let clientToken: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    clientToken = authHeader.substring(7).trim();
  } else if (typeof req.query.token === 'string') {
    clientToken = req.query.token.trim();
  }

  if (!clientToken || clientToken !== configuredToken) {
    res.status(401).json({
      error: 'Unauthorized: Invalid or missing authentication token. Send Authorization: Bearer <TOKEN>',
    });
    return;
  }

  next();
}

/**
 * Read-Only Guard Middleware
 * Rejects write, create, rename and delete operations when NEBULA_READONLY=true
 */
export function readOnlyGuard(req: Request, res: Response, next: NextFunction): void {
  const isReadOnly = process.env.NEBULA_READONLY === 'true';
  const writeMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];

  if (isReadOnly && writeMethods.includes(req.method.toUpperCase())) {
    res.status(403).json({
      error: 'Server is running in read-only mode (NEBULA_READONLY=true). File modifications are forbidden.',
    });
    return;
  }

  next();
}

/**
 * Basic in-memory rate limiter to prevent abuse (sliding window per IP)
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 350; // generous for quick directory traversals

export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  let entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(ip, entry);
  } else {
    entry.count += 1;
  }

  if (entry.count > MAX_REQUESTS_PER_WINDOW) {
    res.status(429).json({
      error: 'Too Many Requests: Rate limit exceeded. Please wait a moment.',
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    });
    return;
  }

  next();
}
