#!/usr/bin/env node
/* ==========================================================================
   gen-code.mjs - TAO MA KICH HOAT THANH VIEN (chi chu web chay)

   Ma co dang:  PM3-<ten>.<YYMMDD>-<chu ky 6 ky tu>

     node tools/gen-code.mjs --name "nguyen van a" --days 365
     node tools/gen-code.mjs --name "tran thi b" --until 2027-06-30
     node tools/gen-code.mjs --name "lop-k35" --days 30 --count 20

   - --name   : ten thanh vien / ten lop (khong bat buoc, bo trong = dung chung)
   - --days   : so ngay tu hom nay
   - --until  : ngay het han YYYY-MM-DD (thay cho --days)
   - --count  : tao nhieu ma cung luc (moi ma khac nhau o phan ten)

   SECRET phai GIONG HET khoa trong assets/js/membership.js.
   ========================================================================== */
import crypto from "node:crypto";

const SECRET = "PM3-2026-KERO-LUONG-生产管理-3級-7f3a91";

function fold(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function sign(nameKey, expiry) {
  return crypto
    .createHmac("sha256", SECRET)
    .update(nameKey + "|" + expiry)
    .digest("hex")
    .slice(0, 6)
    .toUpperCase();
}

function yymmdd(d) {
  return String(d.getFullYear() - 2000).padStart(2, "0") +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0");
}

function makeCode(name, expiry) {
  const clean = String(name || "").trim();
  const nameKey = clean === "" ? "PM3" : fold(clean);
  const sig = sign(nameKey, expiry);
  return "PM3-" + (clean === "" ? "" : clean) + (clean === "" ? "" : ".") + expiry + "-" + sig;
}

/* ---------- Tham so dong lenh ---------- */
const argv = process.argv.slice(2);
const opt = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith("--")) continue;
  const key = a.slice(2);
  const next = argv[i + 1];
  if (next && !next.startsWith("--")) {
    opt[key] = next;
    i++;
  } else {
    opt[key] = true;
  }
}

const name = opt.name ? String(opt.name) : "";
const count = Math.max(1, Number(opt.count || 1));

let expiry;
if (opt.until) {
  const m = String(opt.until).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    console.error("--until phai co dang YYYY-MM-DD");
    process.exit(2);
  }
  expiry = String(Number(m[1]) - 2000).padStart(2, "0") + m[2] + m[3];
} else {
  const days = Number(opt.days || 365);
  const d = new Date();
  d.setDate(d.getDate() + days);
  expiry = yymmdd(d);
}

console.log("");
console.log("Het han: 20" + expiry.slice(0, 2) + "-" + expiry.slice(2, 4) + "-" + expiry.slice(4, 6));
console.log("");

const codes = [];
for (let i = 0; i < count; i++) {
  // Nhieu ma: gan them so thu tu de moi ma khac nhau.
  const nm = count > 1 ? (name ? name + "-" + (i + 1) : "tv" + (i + 1)) : name;
  codes.push(makeCode(nm, expiry));
}

codes.forEach((c) => console.log(c));

if (count > 1) {
  console.log("");
  console.log("Da tao " + count + " ma. Luu y: moi ma gan voi mot ten rieng.");
}
console.log("");