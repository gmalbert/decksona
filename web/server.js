const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const root = __dirname;
const port = Number(process.env.DECKSONA_WEB_PORT || 8797);
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml'
};

const server = http.createServer((request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end('Method not allowed'); return; }
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400).end('Bad request'); return; }
  if (pathname === '/') pathname = '/index.html';
  const file = path.resolve(root, `.${pathname}`);
  if (!file.startsWith(`${root}${path.sep}`) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found'); return;
  }
  response.writeHead(200, {
    'Content-Type': types[path.extname(file)] || 'application/octet-stream',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: http: https:; media-src 'self' blob: data:; connect-src 'self' ws: wss: https://musicbrainz.org https://www.wikidata.org https://en.wikipedia.org; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
  });
  fs.createReadStream(file).pipe(response);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Decksona web player: http://localhost:${port}`);
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) if ((entry.family === 'IPv4' || entry.family === 4) && !entry.internal) console.log(`Phone on this Wi-Fi: http://${entry.address}:${port}`);
  }
  console.log('Keep this window open while using Decksona from your phone.');
});
