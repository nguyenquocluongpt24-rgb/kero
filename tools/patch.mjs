/* patch.mjs - ap dung cac file .patch vao 1 file dich
   Dung: node tools/patch.mjs <file-dich> <thu-muc-patch>
   Moi file .patch co dang:  <old text>\n@@@SPLIT@@@\n<new text>
   Yeu cau: moi <old text> phai xuat hien dung 1 lan. */
import fs from "node:fs";
import path from "node:path";

const [, , target, dir] = process.argv;
if (!target || !dir) {
  console.error("Dung: node tools/patch.mjs <file-dich> <thu-muc-patch>");
  process.exit(2);
}
const abs = path.resolve(target);
const raw = fs.readFileSync(abs, "utf8");
const eol = raw.includes("\r\n") ? "\r\n" : "\n";
let text = raw.replace(/\r\n/g, "\n");
const MARK = "\n@@@SPLIT@@@\n";

const files = fs.readdirSync(path.resolve(dir)).filter((f) => f.endsWith(".patch")).sort();
let ok = 0;
const failed = [];

for (const f of files) {
  let body = fs.readFileSync(path.join(path.resolve(dir), f), "utf8").replace(/\r\n/g, "\n");
  const idx = body.indexOf(MARK);
  if (idx < 0) {
    failed.push(f + ": thieu marker @@@SPLIT@@@");
    continue;
  }
  let oldS = body.slice(0, idx);
  let newS = body.slice(idx + MARK.length);
  if (oldS.endsWith("\n")) oldS = oldS.slice(0, -1);
  if (newS.endsWith("\n")) newS = newS.slice(0, -1);
  const count = text.split(oldS).length - 1;
  if (count !== 1) {
    failed.push(f + ": tim thay " + count + " lan (can dung 1)");
    continue;
  }
  text = text.replace(oldS, newS);
  ok++;
  console.log("OK  " + f);
}

if (failed.length) {
  console.error("\nKHONG AP DUNG DUOC:\n" + failed.join("\n"));
  process.exit(1);
}
fs.writeFileSync(abs, text.replace(/\n/g, eol), "utf8");
console.log("\nDa ap dung " + ok + "/" + files.length + " patch vao " + path.basename(abs));