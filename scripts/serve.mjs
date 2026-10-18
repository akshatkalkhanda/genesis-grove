import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
const port = Number(process.env.PORT || 4173);
createServer(async (req, res) => {
    try {
        const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        const filename = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
        const relative = path.relative(root, filename);
        if (relative.startsWith('..') || path.isAbsolute(relative) || !['src', 'assets', 'index.html'].includes(relative.split(path.sep)[0])) {
            res.writeHead(403); res.end('Forbidden'); return;
        }
        const content = await readFile(filename);
        res.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(content);
    } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Genesis Grove: http://127.0.0.1:${port}`));
