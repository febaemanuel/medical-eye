import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { handleApi } from './api.mjs';

const webRoot = fileURLToPath(new URL('../web/', import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2',
};
const headers = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
};

async function readBody(request, max) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    total += chunk.length;
    if (total > max) {
      request.resume();
      return null;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, total);
}

export function createAppServer(config = process.env) {
  return createServer(async (request, response) => {
    for (const [key, value] of Object.entries(headers)) response.setHeader(key, value);
    try {
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        response.setHeader('Cache-Control', 'no-store');
        const max = url.pathname === '/api/analyze' ? 4 * 1024 * 1024 : 16 * 1024;
        const body = request.method === 'POST' ? await readBody(request, max) : undefined;
        if (body === null) {
          response.writeHead(413, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ error: 'O arquivo ou solicitação excedeu o limite permitido.' }));
          return;
        }
        const result = await handleApi(new Request(url, { method: request.method, body, headers: request.headers }), config);
        response.writeHead(result.status, Object.fromEntries(result.headers));
        response.end(await result.text());
        return;
      }
      if (!['GET', 'HEAD'].includes(request.method)) {
        response.writeHead(405).end();
        return;
      }
      const path = url.pathname === '/' ? '/index.html' : url.pathname;
      if (!/^\/[A-Za-z0-9_.\-/]+$/.test(path) || path.includes('..') || !types[extname(path)]) {
        response.writeHead(404).end();
        return;
      }
      const data = await readFile(webRoot + path.slice(1));
      response.writeHead(200, { 'Content-Type': types[extname(path)], 'Cache-Control': 'no-cache' });
      response.end(request.method === 'HEAD' ? undefined : data);
    } catch (error) {
      if (!response.headersSent) response.writeHead(error.code === 'ENOENT' ? 404 : 500);
      response.end();
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { values } = parseArgs({ options: {
    host: { type: 'string' }, port: { type: 'string' }, strictPort: { type: 'boolean' },
  } });
  const port = Number(values.port || process.env.PORT || 4310);
  const host = values.host || process.env.HOST || '127.0.0.1';
  createAppServer().listen(port, host, () => console.log('Medical Eye disponível na porta ' + port));
}
