const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.geojson':'application/geo+json', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.ttf':'font/ttf'};
http.createServer((req,res) => {
    let file;
    try { file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname)); }
    catch { res.writeHead(400).end(); return; }
    if (!file.startsWith(root + path.sep) && file !== root) {res.writeHead(403).end(); return;}
    if (file === root) file = path.join(root, 'index.html');
    fs.readFile(file, (error, bytes) => {
        if (error) {res.writeHead(404).end(); return;}
        const security = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8')).headers[1].headers;
        res.writeHead(200, {'Cache-Control': 'no-cache', 'Content-Type': types[path.extname(file)] || 'application/octet-stream', ...Object.fromEntries(security.map(header => [header.key, header.value]))}).end(bytes);
    });
}).listen(8080, '127.0.0.1');
