// Local-only static preview for src/app/compare.html and src/app/reference.html.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.APP_TEST_PORT ?? 4174);
const contentType = (file) => /\.(mjs|js)$/.test(file) ? 'text/javascript'
  : file.endsWith('.css') ? 'text/css' : file.endsWith('.json') ? 'application/json'
    : file.endsWith('.svg') ? 'image/svg+xml' : file.endsWith('.png') ? 'image/png'
      : 'text/html';

http.createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  try {
    response.setHeader('Content-Type', contentType(file));
    response.end(await readFile(file));
  } catch {
    response.writeHead(404).end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`Local game comparison: http://127.0.0.1:${port}/src/app/compare.html`));
