import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import { comparePublicOffers } from './compare.js';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

export function createApp({ compare = comparePublicOffers } = {}) {
  return createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (code, value) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/offers') {
      if (req.method !== 'POST') return send(405, { error: 'Utilisez POST.' });
      if (req.headers['content-type']?.split(';')[0] !== 'application/json') return send(415, { error: 'Envoyez du JSON.' });
      // This service serves its own frontend. No cross-origin proxy or arbitrary target URLs.
      if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}` && req.headers.origin !== `https://${req.headers.host}`) return send(403, { error: 'Origine non autorisée.' });
      const abort = new AbortController();
      res.on('close', () => { if (!res.writableEnded) abort.abort(); });
      try {
        let text = '';
        for await (const chunk of req) { text += chunk.toString(); if (text.length > 4096) return send(413, { error: 'Requête trop volumineuse.' }); }
        let body;
        try { body = JSON.parse(text); } catch { return send(400, { error: 'JSON invalide.' }); }
        const result = await compare(body, { signal: abort.signal });
        if (!abort.signal.aborted) send(200, result);
      } catch (error) {
        if (!abort.signal.aborted) send(400, { error: error.message || 'Comparaison indisponible.' });
      }
      return;
    }
    if (req.method !== 'GET') return send(405, { error: 'Utilisez GET.' });
    try {
      const path = resolve(dist, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
      if (!path.startsWith(dist.endsWith(sep) ? dist : dist + sep)) return send(403, { error: 'Chemin interdit.' });
      const content = await readFile(path);
      res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(content);
    } catch { send(404, { error: 'Page introuvable. Lancez npm run build.' }); }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createApp().listen(4173, '127.0.0.1', () => console.log('PieceAuto : http://127.0.0.1:4173 — livraison 69390 Vernaison, France'));
}
