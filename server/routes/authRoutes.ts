import { Router, Request, Response, NextFunction } from 'express';
import { generateSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';
import { checkPassword, signToken, verifyToken } from '../lib/auth';

export const authRouter = Router();

const SERVICE_NAME = 'Nebula Workspace';

// Rate limiter em memória para proteção contra brute-force em autenticação
const authAttemptsMap = new Map<string, { count: number; resetAt: number }>();
const AUTH_WINDOW_MS = 5 * 60 * 1000; // 5 minutos
const MAX_AUTH_ATTEMPTS = 10;

function authRateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  // Prune map se crescer excessivamente
  if (authAttemptsMap.size > 2000) {
    for (const [key, val] of authAttemptsMap.entries()) {
      if (now > val.resetAt) authAttemptsMap.delete(key);
    }
  }

  let entry = authAttemptsMap.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + AUTH_WINDOW_MS };
    authAttemptsMap.set(ip, entry);
  } else {
    entry.count += 1;
  }

  if (entry.count > MAX_AUTH_ATTEMPTS) {
    res.status(429).json({
      error: 'Muitas tentativas de autenticação. Bloqueado temporariamente por 5 minutos.',
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    });
    return;
  }

  next();
}

/**
 * POST /api/auth/login
 * Body: { password: string, totp?: string }
 * Retorna: { token: string } ou 401
 */
authRouter.post('/login', authRateLimiter, async (req: Request, res: Response) => {
  const { password, totp } = req.body as { password?: string; totp?: string };

  const adminPassword = process.env.NEBULA_ADMIN_PASSWORD;

  // Se não há senha configurada, modo dev — aceita qualquer coisa
  if (!adminPassword) {
    const token = signToken({ role: 'admin' });
    res.json({ token, mfaRequired: false, devMode: true });
    return;
  }

  if (!password) {
    res.status(400).json({ error: 'Senha obrigatória.' });
    return;
  }

  const passwordOk = await checkPassword(password, adminPassword);
  if (!passwordOk) {
    res.status(401).json({ error: 'Senha incorreta.' });
    return;
  }

  // Verifica MFA se configurado
  const mfaSecret = process.env.NEBULA_MFA_SECRET;
  if (mfaSecret) {
    if (!totp) {
      // Senha correta mas MFA pendente
      res.status(206).json({ mfaRequired: true });
      return;
    }

    try {
      const result = verifySync({ token: totp, secret: mfaSecret });
      if (!result.valid) {
        res.status(401).json({ error: 'Código TOTP inválido ou expirado.' });
        return;
      }
    } catch {
      res.status(401).json({ error: 'Código TOTP inválido ou expirado.' });
      return;
    }
  }

  const token = signToken({ role: 'admin' });
  res.json({ token, mfaRequired: false });
});

/**
 * GET /api/auth/mfa-setup
 * Gera e retorna o QR Code para configurar o app autenticador.
 * Requer NEBULA_MFA_SETUP=true e autenticação do administrador.
 */
authRouter.get('/mfa-setup', async (req: Request, res: Response) => {
  if (process.env.NEBULA_MFA_SETUP !== 'true') {
    res.status(403).json({ error: 'Setup de MFA não permitido. Defina NEBULA_MFA_SETUP=true para habilitá-lo.' });
    return;
  }

  const adminPassword = process.env.NEBULA_ADMIN_PASSWORD;
  if (adminPassword) {
    let authorized = false;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      const decoded = verifyToken(token);
      if (decoded && decoded.role === 'admin') {
        authorized = true;
      }
    }

    const headerPassword = req.headers['x-admin-password'];
    if (!authorized && typeof headerPassword === 'string') {
      if (await checkPassword(headerPassword, adminPassword)) {
        authorized = true;
      }
    }

    if (!authorized) {
      res.status(401).json({
        error: 'Autenticação necessária para acessar o setup de MFA. Forneça o token ou a senha no cabeçalho x-admin-password.',
      });
      return;
    }
  }

  let secret = process.env.NEBULA_MFA_SECRET;
  if (!secret) {
    // Gera um novo secret se não existir
    secret = generateSecret();
    res.json({
      secret,
      message: 'Copie este secret para NEBULA_MFA_SECRET no .env e reinicie o servidor.',
      qrCode: null,
    });
    return;
  }

  const adminUser = process.env.NEBULA_ADMIN_USER || 'admin';
  const otpAuthUrl = generateURI({
    issuer: SERVICE_NAME,
    label: adminUser,
    secret,
  });

  try {
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);
    res.json({
      secret,
      otpAuthUrl,
      qrCode: qrCodeDataUrl,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Falha ao gerar QR Code: ' + err.message });
  }
});

/**
 * POST /api/auth/verify-totp
 * Body: { totp: string }
 * Verifica código TOTP independentemente (para validação no frontend sem senha)
 */
authRouter.post('/verify-totp', authRateLimiter, (req: Request, res: Response) => {
  const { totp } = req.body as { totp?: string };
  const mfaSecret = process.env.NEBULA_MFA_SECRET;

  if (!mfaSecret) {
    res.json({ valid: true, message: 'MFA não configurado.' });
    return;
  }

  if (!totp) {
    res.status(400).json({ error: 'Código TOTP obrigatório.' });
    return;
  }

  try {
    const result = verifySync({ token: totp, secret: mfaSecret });
    if (result.valid) {
      res.json({ valid: true });
    } else {
      res.status(401).json({ valid: false, error: 'Código TOTP inválido.' });
    }
  } catch {
    res.status(401).json({ valid: false, error: 'Código TOTP inválido.' });
  }
});

