import { Router, Request, Response, NextFunction } from 'express';
import { generateSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';
import {
  checkPassword,
  signToken,
  verifyToken,
  getEffectiveAdminPassword,
  isMfaActive,
  getEffectiveMfaSecret,
  saveAuthConfig,
  getAuthConfig,
  hashPassword,
  requireAuth
} from '../lib/auth';

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
 * GET /api/auth/status
 * Retorna o status de autenticação (se há senha e se MFA está ativo)
 */
authRouter.get('/status', (_req: Request, res: Response) => {
  const adminPassword = getEffectiveAdminPassword();
  const mfaEnabled = isMfaActive();
  res.json({
    hasPassword: Boolean(adminPassword),
    mfaEnabled,
    user: process.env.NEBULA_ADMIN_USER || 'admin',
  });
});

/**
 * POST /api/auth/login
 * Body: { password: string, totp?: string }
 * Retorna: { token: string } ou 401
 */
authRouter.post('/login', authRateLimiter, async (req: Request, res: Response) => {
  const { password, totp } = req.body as { password?: string; totp?: string };

  const adminPassword = getEffectiveAdminPassword();

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

  // Verifica MFA se configurado e ativo
  if (isMfaActive()) {
    const mfaSecret = getEffectiveMfaSecret();
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
  }

  const token = signToken({ role: 'admin' });
  res.json({ token, mfaRequired: false });
});

/**
 * POST /api/auth/change-password
 * Permite alterar a senha do administrador a partir das Configurações Globais
 */
authRouter.post('/change-password', requireAuth, async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  const adminPassword = getEffectiveAdminPassword();

  if (!newPassword || newPassword.length < 6) {
    res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
    return;
  }

  if (adminPassword) {
    if (!currentPassword) {
      res.status(400).json({ error: 'Senha atual é obrigatória.' });
      return;
    }
    const match = await checkPassword(currentPassword, adminPassword);
    if (!match) {
      res.status(401).json({ error: 'Senha atual incorreta.' });
      return;
    }
  }

  const hash = await hashPassword(newPassword);
  const cfg = getAuthConfig();
  saveAuthConfig({ ...cfg, passwordHash: hash, updatedAt: Date.now() });

  res.json({ ok: true, message: 'Senha do administrador alterada com sucesso.' });
});

/**
 * POST /api/auth/mfa/generate
 * Gera um novo secret temporário e respectivo QR Code para setup em Configurações Globais
 */
authRouter.post('/mfa/generate', requireAuth, async (_req: Request, res: Response) => {
  try {
    const secret = generateSecret();
    const adminUser = process.env.NEBULA_ADMIN_USER || 'admin';
    const otpAuthUrl = generateURI({
      issuer: SERVICE_NAME,
      label: adminUser,
      secret,
    });
    const qrCode = await QRCode.toDataURL(otpAuthUrl);
    res.json({ secret, otpAuthUrl, qrCode });
  } catch (err: any) {
    res.status(500).json({ error: 'Falha ao gerar QR Code: ' + err.message });
  }
});

/**
 * POST /api/auth/mfa/enable
 * Confirma o código do app autenticador e ativa o MFA permanentemente
 */
authRouter.post('/mfa/enable', requireAuth, (req: Request, res: Response) => {
  const { secret, totp } = req.body as { secret?: string; totp?: string };

  if (!secret || !totp) {
    res.status(400).json({ error: 'Secret e código TOTP são obrigatórios para ativação.' });
    return;
  }

  try {
    const result = verifySync({ token: totp, secret });
    if (!result.valid) {
      res.status(400).json({ error: 'Código de 6 dígitos inválido ou expirado.' });
      return;
    }

    const cfg = getAuthConfig();
    saveAuthConfig({ ...cfg, mfaEnabled: true, mfaSecret: secret, updatedAt: Date.now() });
    res.json({ ok: true, message: 'Autenticação em dois fatores (MFA) ativada com sucesso.' });
  } catch {
    res.status(400).json({ error: 'Código de verificação TOTP inválido.' });
  }
});

/**
 * POST /api/auth/mfa/disable
 * Desativa o MFA e remove os dispositivos vinculados
 */
authRouter.post('/mfa/disable', requireAuth, async (req: Request, res: Response) => {
  const { currentPassword } = req.body as { currentPassword?: string };
  const adminPassword = getEffectiveAdminPassword();

  if (adminPassword) {
    if (!currentPassword) {
      res.status(400).json({ error: 'Informe a senha atual para desativar o MFA.' });
      return;
    }
    const match = await checkPassword(currentPassword, adminPassword);
    if (!match) {
      res.status(401).json({ error: 'Senha incorreta.' });
      return;
    }
  }

  const cfg = getAuthConfig();
  saveAuthConfig({ ...cfg, mfaEnabled: false, mfaSecret: null, updatedAt: Date.now() });
  res.json({ ok: true, message: 'MFA desativado e dispositivos removidos.' });
});

/**
 * GET /api/auth/mfa-setup (Compatibilidade retroativa com QR Code corrigido)
 */
authRouter.get('/mfa-setup', async (req: Request, res: Response) => {
  if (process.env.NEBULA_MFA_SETUP !== 'true') {
    res.status(403).json({ error: 'Setup de MFA não permitido. Defina NEBULA_MFA_SETUP=true para habilitá-lo.' });
    return;
  }

  const adminPassword = getEffectiveAdminPassword();
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

  const secret = getEffectiveMfaSecret() || generateSecret();
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
 */
authRouter.post('/verify-totp', authRateLimiter, (req: Request, res: Response) => {
  const { totp } = req.body as { totp?: string };
  const mfaSecret = getEffectiveMfaSecret();

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


