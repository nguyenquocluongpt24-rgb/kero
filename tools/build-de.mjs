/* ==========================================================================
   build-de.mjs - Sinh "kho de" cho web luyen thi 生産管理 3級

   Nhiem vu:
     1. Quet moi file JSON trong thu muc `de/`.
     2. Voi moi de, sinh them 1 bundle JS `de/<slug>.js` de app nap duoc ca
        khi mo bang `file://` (trinh duyet chan fetch file JSON o che do nay).
     3. Sinh `data/library.js` - manifest liet ke toan bo de cho giao dien
        "Thu vien bo de".

   Cach dung (chay trong thu muc goc du an):
       node tools/build-de.mjs

   Quy uoc:
     - De MIEN PHI  : ten file khop FREE_MATCHERS (mac dinh: co "R7").
     - Cac de khac  : yeu cau dang nhap thanh vien moi mo duoc.
     Muon doi danh sach mien phi -> sua FREE_MATCHERS roi chay lai script.
   ========================================================================== */

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DE_DIR = path.join(ROOT, "de");
const DATA_DIR = path.join(ROOT, "data");

/** De mien phi: ten file khop mot trong cac mau nay. */
const FREE_MATCHERS = [/R7/i];

const CHAPTERS = [
  { no: "01", jp: "品質管理", vn: "Quản lý chất lượng" },
  { no: "02", jp: "原価管理", vn: "Quản lý chi phí" },
  { no: "03", jp: "納期管理", vn: "Quản lý thời hạn giao hàng" },
  { no: "04", jp: "安全衛生", vn: "An toàn & vệ sinh lao động" },
  { no: "05", jp: "環境管理", vn: "Quản lý môi trường" },
  { no: "06", jp: "作業管理", vn: "Quản lý công việc" },
  { no: "07", jp: "工程管理", vn: "Quản lý công đoạn" },
  { no: "08", jp: "設備管理", vn: "Quản lý thiết bị" },
  { no: "09", jp: "資材・在庫管理", vn: "Quản lý vật tư & tồn kho" },
  { no: "10", jp: "運搬・物流管理", vn: "Quản lý vận chuyển & logistics" }
];

function slugify(name) {
  const s = name
    .toLowerCase()
    .replace(/\.json$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "de";
}

function isFree(name) {
  return FREE_MATCHERS.some((re) => re.test(name));
}

function resolveChapterNo(raw) {
  const s = String(raw || "").trim();
  let m = s.match(/^(\d{1,2})\s*[.．、]\s*(.*)$/);
  if (m && CHAPTERS.find((c) => Number(c.no) === Number(m[1]))) return m[1];
  const compact = s.replace(/\s+/g, "");
  const direct = CHAPTERS.find((c) => compact === c.jp || compact.includes(c.jp) || c.jp.includes(compact));
  if (direct) return direct.no;
  m = s.match(/^(\d{1,2})/);
  if (m && CHAPTERS.find((c) => Number(c.no) === Number(m[1]))) return m[1];
  return "--";
}

function validate(list, file) {
  if (!Array.isArray(list)) throw new Error(file + ": noi dung phai la mang [...]");
  if (!list.length) throw new Error(file + ": mang rong");
  const seen = new Set();
  list.forEach((item, i) => {
    const at = i + 1;
    if (!item || typeof item !== "object") throw new Error(file + ": cau #" + at + " khong hop le");
    const id = String(item.id == null ? "" : item.id).trim();
    if (!id) throw new Error(file + ": cau #" + at + ' thieu "id"');
    if (seen.has(id)) throw new Error(file + ': "id" trung (' + id + ")");
    seen.add(id);
    const keys = (Array.isArray(item.options) ? item.options : []).map((o) => String((o || {}).key || "").trim());
    if (keys.length < 2) throw new Error(file + ": cau #" + at + " can it nhat 2 dap an");
    const correct = String(item.correct_answer == null ? "" : item.correct_answer).trim();
    if (!correct) throw new Error(file + ': cau #' + at + ' thieu "correct_answer"');
    if (!keys.includes(correct)) throw new Error(file + ': cau #' + at + ' "correct_answer" (' + correct + ") khong khop dap an");
  });
}

async function main() {
  if (!existsSync(DE_DIR)) await mkdir(DE_DIR, { recursive: true });
  if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true });

  const files = (await readdir(DE_DIR))
    .filter((f) => /\.json$/i.test(f))
    .sort((a, b) => a.localeCompare(b, "en"));

  if (!files.length) console.warn("! Khong tim thay file JSON nao trong thu muc 'de/'.");

  const manifest = [];

  for (const file of files) {
    const full = path.join(DE_DIR, file);
    const raw = await readFile(full, "utf8");
    let list;
    try {
      list = JSON.parse(raw.replace(/^\uFEFF/, ""));
    } catch (e) {
      console.error("X " + file + ": JSON khong hop le - " + e.message);
      continue;
    }
    try {
      validate(list, file);
    } catch (e) {
      console.error("X " + e.message);
      continue;
    }

    const name = file.replace(/\.json$/i, "");
    const id = slugify(file);
    const bundleFile = id + ".js";

    const bundle =
      "/* AUTO-GENERATED boi tools/build-de.mjs - dung sua tay.\n" +
      "   Nguon: de/" + file + " */\n" +
      "window.PM3_SETS = window.PM3_SETS || {};\n" +
      "window.PM3_SETS[" + JSON.stringify(id) + "] = " + JSON.stringify(list) + ";\n";
    await writeFile(path.join(DE_DIR, bundleFile), bundle, "utf8");

    const chapters = {};
    list.forEach((q) => {
      const no = resolveChapterNo(q.chapter);
      chapters[no] = (chapters[no] || 0) + 1;
    });

    manifest.push({
      id: id,
      name: name,
      file: "de/" + file,
      bundle: "de/" + bundleFile,
      free: isFree(name),
      count: list.length,
      chapters: chapters
    });

    console.log("OK " + file + "  ->  de/" + bundleFile + "  (" + list.length + " cau, " + (isFree(name) ? "MIEN PHI" : "THANH VIEN") + ")");
  }

  manifest.sort((a, b) => Number(b.free) - Number(a.free) || b.name.localeCompare(a.name, "en"));

  const out =
    "/* AUTO-GENERATED boi tools/build-de.mjs - dung sua tay.\n" +
    "   Danh sach bo de cho giao dien 'Thu vien bo de'.\n" +
    "   free: true = ai cung mo duoc; false = can MA KICH HOAT thanh vien. */\n" +
    "window.PM3_LIBRARY = " +
    JSON.stringify(manifest, null, 2) +
    ";\n";
  await writeFile(path.join(DATA_DIR, "library.js"), out, "utf8");

  console.log("");
  console.log("-> Da ghi data/library.js (" + manifest.length + " bo de: " + manifest.filter((m) => m.free).length + " mien phi, " + manifest.filter((m) => !m.free).length + " thanh vien).");
}

main().catch((e) => {
  console.error("Loi:", e);
  process.exit(1);
});