// Local static stand-in for the Pages project URL. Run from any cwd with Node.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const prefix = '/tdc.game.goblin/';
const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
};

createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
  try {
    if (!pathname.startsWith(prefix)) throw new Error('outside project prefix');
    const relative = decodeURIComponent(pathname.slice(prefix.length)) || 'index.html';
    const file = resolve(root, relative);
    if (file !== root && !file.startsWith(root + sep)) throw new Error('outside checkout');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    console.error(`404 ${pathname}`);
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}).listen(4174, '127.0.0.1', () => console.log(`Pages prefix preview: http://127.0.0.1:4174${prefix}src/app/shell.html`));
