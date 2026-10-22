// Read-only local serving of the prepared probe inputs. No browser launch.
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const dir = resolve(process.argv[2] || '');
const port = Number(process.argv[3] || 4183);
if (!process.argv[2] || !Number.isInteger(port) || port < 1024 || port > 65535)
  throw Error('Usage: node serve.mjs PREPARED_DIR [PORT]');
const specialists = existsSync(join(dir, 'contract.json'));
const allowed = new Map([
  ['/harness.html', 'text/html; charset=utf-8'],
  ['/generator.html', 'text/html; charset=utf-8'],
  ['/level.json', 'application/json; charset=utf-8'],
  [specialists ? '/contract.json' : '/render-only-test-card.cells.json', 'application/json; charset=utf-8'],
]);
createServer(async (req, res) => {
  const path = req.url === '/' ? '/harness.html' : req.url;
  if (req.method !== 'GET' || !allowed.has(path)) {
    res.writeHead(404); res.end(); return;
  }
  try {
    const body = await readFile(join(dir, path.slice(1)));
    res.writeHead(200, {
      'Content-Type': allowed.get(path), 'Content-Length': body.length,
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    });
    res.end(body);
  } catch {
    res.writeHead(500); res.end('Prepared file missing');
  }
}).listen(port, '127.0.0.1', () =>
  process.stdout.write(`Map bake probe: http://127.0.0.1:${port}/harness.html\n`));
