import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'assets', 'js', 'cloud-config.js');
const id = (process.argv[2] || '').trim();

if (!id) {
  console.log('Cach dung: node tools/set-oauth.mjs 1234-abc.apps.googleusercontent.com');
  process.exit(1);
}
if (!/[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(id)) {
  console.log('Canh bao: Client ID phai co duoi .apps.googleusercontent.com');
}
let text = fs.readFileSync(FILE, 'utf8');
const re = /oauthClientId:\s*"[^"]*"/;
if (!re.test(text)) {
  console.log('Khong tim thay dong oauthClientId');
  process.exit(1);
}
text = text.replace(re, 'oauthClientId: ' + JSON.stringify(id));
fs.writeFileSync(FILE, text, 'utf8');
console.log('Da ghi OAuth Client ID vao assets/js/cloud-config.js');
console.log('Chay: npx --yes serve . -l 8778  ->  http://localhost:8778');
