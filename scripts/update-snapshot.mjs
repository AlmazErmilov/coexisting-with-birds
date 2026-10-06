import {readFileSync, writeFileSync, readdirSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve, join} from 'node:path';
const root = resolve(import.meta.dirname, '..');
const walk = directory => readdirSync(join(root, directory), {withFileTypes:true}).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
}).sort();
const core = ['./', 'index.html', 'about.html', 'docs/bird-images.html', 'docs/bird-images.md', ...walk('js'), ...walk('css'), ...walk('data'), ...walk('fonts'),
    ...walk('assets/vendor').filter(path => /\.(js|css|png)$/.test(path))];
const photos = existsSync(join(root, 'assets/birds')) ? walk('assets/birds').filter(path => /\.(jpg|jpeg|png|svg|webp)$/i.test(path)) : [];
const hash = createHash('sha256');
for (const path of [...core.filter(path => path !== './'), ...photos].sort()) {
    hash.update(path).update(readFileSync(join(root, path)));
}
const workerPath = join(root, 'service-worker.js');
let worker = readFileSync(workerPath, 'utf8');
hash.update(worker.replace(/const VERSION = '[^']+';/, "const VERSION = '__VERSION__';")
    .replace(/const CORE = \[[\s\S]*?\];/, 'const CORE = [];')
    .replace(/const PHOTOS = \[[\s\S]*?\];/, 'const PHOTOS = [];'));
const version = 'birds-' + hash.digest('hex').slice(0,16);
worker = worker.replace(/const VERSION = '[^']+';/, `const VERSION = '${version}';`)
    .replace(/const CORE = \[[\s\S]*?\];/, `const CORE = ${JSON.stringify(core, null, 4)};`)
    .replace(/const PHOTOS = \[[\s\S]*?\];/, `const PHOTOS = ${JSON.stringify(photos, null, 4)};`);
writeFileSync(workerPath, worker);
// ASVS 3.4.3: hashes admit only the exact inline analytics and metadata scripts.
const html = readFileSync(join(root, 'index.html'), 'utf8');
const hashes = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map(match => "'sha256-" + createHash('sha256').update(match[1]).digest('base64') + "'");
const configPath = join(root, 'vercel.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));
config.headers[1].headers.find(header => header.key === 'Content-Security-Policy').value =
    "default-src 'self'; script-src 'self' " + hashes.join(' ') + "; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://tile.openstreetmap.org; connect-src 'self' https://vitals.vercel-insights.com https://va.vercel-scripts.com; font-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'";
writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
console.log(`Snapshot ${version}: ${core.length} core files and ${photos.length} optional images.`);
