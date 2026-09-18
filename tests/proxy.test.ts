import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import http from 'http';
import { proxyRouter } from '../server/routes/proxyRoutes';

describe('Proxy Routes — SSRF & Security Validations', () => {
  let app: express.Express;
  let server: http.Server;
  let baseUrl: string;

  before(async () => {
    app = express();
    app.use(express.json());
    app.use('/api/proxy', proxyRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          baseUrl = `http://127.0.0.1:${addr.port}/api/proxy`;
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

  test('Rejeita requisição sem parâmetro "url"', async () => {
    const res = await fetch(baseUrl);
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.error, 'Parâmetro "url" é obrigatório.');
  });

  test('Rejeita URL malformada', async () => {
    const res = await fetch(`${baseUrl}?url=invalid-url-string`);
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.error, 'URL fornecida é inválida.');
  });

  test('Bloqueia protocolos não seguros (file:, ftp:, javascript:)', async () => {
    for (const url of ['file:///etc/passwd', 'ftp://ftp.example.com', 'javascript:alert(1)']) {
      const res = await fetch(`${baseUrl}?url=${encodeURIComponent(url)}`);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error, 'Apenas os protocolos http: e https: são permitidos.');
    }
  });

  test('Bloqueia host localhost e 127.0.0.1 (Loopback)', async () => {
    const resLocalhost = await fetch(`${baseUrl}?url=http://localhost:3000/api/health`);
    assert.strictEqual(resLocalhost.status, 403);
    const dataLocalhost = await resLocalhost.json();
    assert.ok(dataLocalhost.error.includes('proibido'));

    const res127 = await fetch(`${baseUrl}?url=http://127.0.0.1:8080/`);
    assert.strictEqual(res127.status, 403);
    const data127 = await res127.json();
    assert.ok(data127.error.includes('proibido'));
  });

  test('Bloqueia hosts especiais de Cloud Metadata', async () => {
    const resMetadata = await fetch(`${baseUrl}?url=http://metadata.google.internal/computeMetadata/v1/`);
    assert.strictEqual(resMetadata.status, 403);

    const resInstance = await fetch(`${baseUrl}?url=http://instance-data/latest/meta-data/`);
    assert.strictEqual(resInstance.status, 403);

    const resIpMetadata = await fetch(`${baseUrl}?url=http://169.254.169.254/latest/meta-data/`);
    assert.strictEqual(resIpMetadata.status, 403);
  });

  test('Bloqueia IPs privados RFC 1918 (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)', async () => {
    const privateUrls = [
      'http://10.0.0.1/admin',
      'http://10.255.255.1/',
      'http://172.16.0.1:8080/',
      'http://172.31.255.255/',
      'http://192.168.1.1/',
      'http://192.168.0.100:3000/',
    ];

    for (const url of privateUrls) {
      const res = await fetch(`${baseUrl}?url=${encodeURIComponent(url)}`);
      assert.strictEqual(res.status, 403, `Deveria bloquear ${url}`);
      const data = await res.json();
      assert.ok(data.error.includes('proibido'));
    }
  });

  test('Bloqueia domínios internos com sufixo .local ou .internal', async () => {
    const resLocal = await fetch(`${baseUrl}?url=http://myrouter.local/status`);
    assert.strictEqual(resLocal.status, 403);

    const resInternal = await fetch(`${baseUrl}?url=http://backend.internal/api`);
    assert.strictEqual(resInternal.status, 403);
  });
});
