/**
 * proxyRoutes.ts — Nebula API Proxy v2.6 / v2.7 (SSRF-Protected)
 *
 * Proxy HTTP para o API Client Window do frontend,
 * evitando restrições de CORS ao testar APIs externas públicas.
 * Protegido rigorosamente contra SSRF, loopback, metadados de cloud,
 * bypass via redirecionamentos (301/302) e DoS por exaustão de memória.
 */

import { Router, Request, Response } from 'express';
import dns from 'dns';

export const proxyRouter = Router();

const BLOCKED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
  'metadata.google.internal',
  'instance-data',
]);

function isPrivateOrReservedIP(ip: string): boolean {
  let cleanIp = ip;
  // Normaliza IPv4 mapeado em IPv6 (ex: ::ffff:127.0.0.1)
  if (cleanIp.startsWith('::ffff:')) {
    cleanIp = cleanIp.slice(7);
  }

  // IPv4 Check
  const parts = cleanIp.split('.').map(Number);
  if (parts.length === 4 && parts.every((n) => !isNaN(n) && n >= 0 && n <= 255)) {
    const [a, b] = parts;
    if (a === 0) return true;                             // 0.0.0.0/8
    if (a === 127) return true;                           // 127.0.0.0/8 (Loopback)
    if (a === 10) return true;                            // 10.0.0.0/8 (Privado)
    if (a === 172 && b >= 16 && b <= 31) return true;     // 172.16.0.0/12 (Privado)
    if (a === 192 && b === 168) return true;              // 192.168.0.0/16 (Privado)
    if (a === 169 && b === 254) return true;              // 169.254.0.0/16 (Link-local & Metadata)
    if (a === 100 && b >= 64 && b <= 127) return true;   // 100.64.0.0/10 (Carrier-grade NAT)
    if (a >= 224) return true;                            // 224.0.0.0/4 (Multicast e Reservado)
    return false;
  }

  // IPv6 Check
  const lower = cleanIp.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true; // fe80::/10 (Link-local)
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // fc00::/7 (ULA)
  return false;
}

/**
 * Validação rigorosa de URL e resolução de DNS antes de qualquer salto HTTP
 */
async function validateUrlAndDNS(urlString: string): Promise<{ error?: string; status?: number; parsed?: URL }> {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return { error: 'URL fornecida é inválida.', status: 400 };
  }

  // Apenas protocolos seguros da web
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { error: 'Apenas os protocolos http: e https: são permitidos.', status: 400 };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Bloqueio de hosts especiais / metadata
  if (BLOCKED_HOSTS.has(hostname) || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    return { error: 'Acesso ao destino proibido (host restrito).', status: 403 };
  }

  // Resolução e validação de DNS antes da requisição (Prevenção de SSRF)
  try {
    const addresses = await dns.promises.lookup(hostname, { all: true });
    for (const record of addresses) {
      if (isPrivateOrReservedIP(record.address)) {
        return {
          error: 'Acesso ao destino proibido: resolve para endereço de IP privado ou reservado.',
          status: 403,
        };
      }
    }
  } catch (err: any) {
    return { error: `Falha na resolução de DNS para ${hostname}: ${err.message}`, status: 502 };
  }

  return { parsed };
}

/**
 * GET /api/proxy/web?url=...
 * Permite navegação web segura dentro de iframe no WebEmbedWindow,
 * removendo cabeçalhos restritivos de framing (X-Frame-Options/CSP) e injetando <base>.
 */
proxyRouter.get('/web', async (req: Request, res: Response) => {
  const initialUrl = req.query.url as string;
  if (!initialUrl) {
    res.status(400).send('Parâmetro "url" é obrigatório.');
    return;
  }

  let currentUrl = initialUrl;
  let response: any = null;
  const MAX_REDIRECTS = 3;

  try {
    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
      const validation = await validateUrlAndDNS(currentUrl);
      if (validation.error) {
        res.status(validation.status || 403).send(`Acesso negado: ${validation.error}`);
        return;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      try {
        response = await fetch(currentUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          },
          redirect: 'manual',
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      // Se for redirecionamento, segue para o próximo salto
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (location) {
          currentUrl = new URL(location, currentUrl).href;
          continue;
        }
      }

      break;
    }

    if (!response) {
      res.status(502).send('Falha ao obter resposta do destino.');
      return;
    }

    const contentType = response.headers.get('content-type') || 'text/html; charset=utf-8';
    let body = await response.text();

    if (contentType.includes('text/html')) {
      const baseTag = `<base href="${currentUrl}">`;
      const antiBustScript = `
        <script>
          try {
            // Neutraliza frame-busting de sites legados
            window.onbeforeunload = null;
            Object.defineProperty(window, 'top', { get: function() { return window.self; } });
            Object.defineProperty(window, 'parent', { get: function() { return window.self; } });
          } catch(e) {}
        </script>
      `;

      if (body.includes('<head>')) {
        body = body.replace('<head>', `<head>${baseTag}${antiBustScript}`);
      } else {
        body = `${baseTag}${antiBustScript}${body}`;
      }
    }

    // Remove todos os cabeçalhos que impedem exibição em iframe
    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');
    res.removeHeader('Content-Security-Policy-Report-Only');
    res.removeHeader('Cross-Origin-Opener-Policy');
    res.removeHeader('Cross-Origin-Embedder-Policy');
    res.removeHeader('X-Content-Type-Options');

    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Security-Policy', "frame-ancestors *;");
    res.status(response.status).send(body);
  } catch (err: any) {
    res.status(502).send(`Erro ao carregar página: ${err.message}`);
  }
});

proxyRouter.all('/', async (req: Request, res: Response) => {
  const initialUrl = (req.query.url as string) || (req.body?.url as string);

  if (!initialUrl) {
    res.status(400).json({ error: 'Parâmetro "url" é obrigatório.' });
    return;
  }

  try {
    const method = req.body?.method || req.method || 'GET';
    const headers: Record<string, string> = { ...req.body?.headers };
    delete headers['host'];
    delete headers['content-length'];

    let body: string | undefined;
    if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && req.body?.body) {
      body = typeof req.body.body === 'string' ? req.body.body : JSON.stringify(req.body.body);
      if (!headers['content-type'] && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
    }

    const startTime = Date.now();
    let currentUrl = initialUrl;
    let response: ResponseType | any = null;
    const MAX_REDIRECTS = 3;

    // Follow redirects manually com revalidação estrita de DNS a cada salto (Fix SSRF redirect bypass)
    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
      const validation = await validateUrlAndDNS(currentUrl);
      if (validation.error) {
        res.status(validation.status || 403).json({ error: validation.error });
        return;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000); // 12s timeout

      try {
        response = await fetch(currentUrl, {
          method: redirectCount === 0 ? method : 'GET',
          headers,
          body: redirectCount === 0 ? body : undefined,
          redirect: 'manual',
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      // Se for redirect, extrai o Location e valida o próximo salto
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) {
          break;
        }
        currentUrl = new URL(location, currentUrl).href;
        continue;
      }

      break;
    }

    const durationMs = Date.now() - startTime;
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value: string, key: string) => {
      responseHeaders[key] = value;
    });

    // Limite de tamanho de payload em memória para prevenir DoS (máximo 10MB)
    const MAX_PAYLOAD_BYTES = 10 * 1024 * 1024;
    const rawLength = Number(response.headers.get('content-length') || 0);
    if (rawLength > MAX_PAYLOAD_BYTES) {
      res.status(413).json({ error: 'Resposta do destino excede o limite permitido em memória (10MB).' });
      return;
    }

    const contentType = response.headers.get('content-type') || '';
    let responseData: unknown;
    if (contentType.includes('application/json')) {
      try {
        responseData = await response.json();
      } catch {
        responseData = await response.text();
      }
    } else {
      responseData = await response.text();
    }

    res.json({
      status: response.status,
      statusText: response.statusText,
      durationMs,
      headers: responseHeaders,
      data: responseData,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({
      error: `Falha ao conectar com o destino: ${message}`,
      status: 502,
    });
  }
});
