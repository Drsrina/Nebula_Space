import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.NEBULA_JWT_SECRET || 'nebula-dev-secret-change-in-production';
const JWT_EXPIRES = '24h';

export interface AuthRequest extends Request {
  user?: { role: string };
}

/** Gera token JWT para a sessão */
export function signToken(payload: object): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES } as jwt.SignOptions);
}

/** Verifica token JWT */
export function verifyToken(token: string): { role: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { role: string };
    return decoded;
  } catch {
    return null;
  }
}

/** Valida senha em texto plano contra hash bcrypt (ou texto direto para desenvolvimento) */
export async function checkPassword(plain: string, stored: string): Promise<boolean> {
  // Se começa com $2b$ é um hash bcrypt
  if (stored.startsWith('$2')) {
    return bcrypt.compare(plain, stored);
  }
  // Comparação direta (modo dev/simples)
  return plain === stored;
}

/** Gera hash bcrypt de uma senha */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

/** Middleware Express que exige JWT válido em Bearer token ou query param */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const adminPassword = process.env.NEBULA_ADMIN_PASSWORD;
  const staticToken = process.env.NEBULA_TOKEN;

  // Em produção, exige que haja senha de admin ou token configurado
  if (!adminPassword && !staticToken) {
    if (process.env.NODE_ENV === 'production') {
      res.status(500).json({
        error: 'Ambiente de produção exige NEBULA_ADMIN_PASSWORD ou NEBULA_TOKEN configurado.',
      });
      return;
    }
    // Modo desenvolvimento sem senha configurada
    next();
    return;
  }

  // Extrai token do header Authorization ou query parameter (suporte a SSE/EventSource)
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (typeof req.query.token === 'string') {
    token = req.query.token.trim();
  }

  if (!token) {
    res.status(401).json({ error: 'Autenticação necessária. Token não fornecido.' });
    return;
  }

  // Aceita tanto NEBULA_TOKEN estático quanto JWT assinado
  if (staticToken && token === staticToken) {
    req.user = { role: 'admin' };
    next();
    return;
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    res.status(401).json({ error: 'Token inválido ou expirado.' });
    return;
  }

  req.user = decoded;
  next();
}
