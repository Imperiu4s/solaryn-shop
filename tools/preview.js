// Helyi előnézet a SolarCenterhez, feltöltés nélkül.
// Használat: node tools/preview.js          -> http://localhost:8735, az éles API-val (a saját fiókoddal lépsz be)
//            node tools/preview.js 8735 http://localhost:18080   -> helyi tesztszerverrel
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.argv[2] || 8735);
const PROD_API = 'https://api.solaryn.hu:25572';
const API = process.argv[3] || PROD_API;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml'
};

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file = path.normalize(path.join(ROOT, url));
  if (!file.startsWith(path.normalize(ROOT))) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(fs.readFileSync(path.join(ROOT, '404.html')));
  }
  const ext = path.extname(file).toLowerCase();
  const headers = { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' };
  if (ext === '.html' || ext === '.js') {
    let body = fs.readFileSync(file, 'utf8').split(PROD_API).join(API);
    if (ext === '.html') body = body.replace(/;\s*upgrade-insecure-requests/, '');
    res.writeHead(200, headers);
    return res.end(body);
  }
  res.writeHead(200, headers);
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log('SolarCenter előnézet: http://localhost:' + PORT + '  (API: ' + API + ')'));
