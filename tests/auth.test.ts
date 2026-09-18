import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import http from 'http';
import { authRouter } from '../server/routes/authRoutes';

describe('Auth Routes — Rate Limiting & MFA Setup Protection', () => {
  let app: express.Express;
  let server: http.Server;
  let baseUrl: string;

  before(async () => {
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          baseUrl = `http://127.0.0.1:${addr.port}/api/auth`;
        }
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  test('Bloqueia /api/auth/mfa-setup com 403 se NEBULA_MFA_SETUP não for "true"', async () => {
    const oldSetup = process.env.NEBULA_MFA_SETUP;
    delete process.env.NEBULA_MFA_SETUP;

    try {
      const res = await fetch(`${baseUrl}/mfa-setup`);
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.match(data.error, /Setup de MFA não permitido/i);
    } finally {
      process.env.NEBULA_MFA_SETUP = oldSetup;
    }
  });

  test('Exige autenticação de administrador no /api/auth/mfa-setup quando senha configurada', async () => {
    const oldSetup = process.env.NEBULA_MFA_SETUP;
    const oldPass = process.env.NEBULA_ADMIN_PASSWORD;
    process.env.NEBULA_MFA_SETUP = 'true';
    process.env.NEBULA_ADMIN_PASSWORD = 'super_secret_admin_pass';

    try {
      // Sem senha / token -> 401
      const resUnauth = await fetch(`${baseUrl}/mfa-setup`);
      assert.strictEqual(resUnauth.status, 401);

      // Com senha errada no header -> 401
      const resWrong = await fetch(`${baseUrl}/mfa-setup`, {
        headers: { 'x-admin-password': 'wrong_password' },
      });
      assert.strictEqual(resWrong.status, 401);

      // Com senha correta no header -> 200
      const resOk = await fetch(`${baseUrl}/mfa-setup`, {
        headers: { 'x-admin-password': 'super_secret_admin_pass' },
      });
      assert.strictEqual(resOk.status, 200);
      const data = await resOk.json();
      assert.ok(data.secret);
    } finally {
      process.env.NEBULA_MFA_SETUP = oldSetup;
      process.env.NEBULA_ADMIN_PASSWORD = oldPass;
    }
  });

  test('Garante que login sem senha configurada retorne token em dev mode', async () => {
    const oldPass = process.env.NEBULA_ADMIN_PASSWORD;
    delete process.env.NEBULA_ADMIN_PASSWORD;

    try {
      const res = await fetch(`${baseUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.token);
      assert.strictEqual(data.devMode, true);
    } finally {
      process.env.NEBULA_ADMIN_PASSWORD = oldPass;
    }
  });
});
