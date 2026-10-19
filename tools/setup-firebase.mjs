/* ==========================================================================
   setup-firebase.mjs — Tự động tạo cấu hình Firebase cho dự án
   --------------------------------------------------------------------------
   Bạn chỉ cần đăng nhập Firebase CLI một lần (firebase login). Script này sẽ:
     1. Tạo (hoặc dùng lại) project Firebase.
     2. Bật Google Sign-in và Email/Password.
     3. Tạo Web App, lấy firebaseConfig.
     4. Bật Google Drive API + tạo API key.
     5. Ghi tất cả vào assets/js/cloud-config.js.

   Cách dùng:
     node tools/setup-firebase.mjs --project pm3-luyenthi

   Tuỳ chọn:
     --project <id>     ID project (mặc định: pm3-luyenthi)
     --name <tên>       Tên hiển thị project
     --drive-folder <id> ID thư mục Drive chứa đề (tuỳ chọn)
     --dry              Chỉ in ra, không ghi file
   ========================================================================== */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_PATH = path.join(ROOT, "assets", "js", "cloud-config.js");
const CLI = path.join(ROOT, "setup-tmp", "node_modules", "firebase-tools", "lib", "bin", "firebase.js");

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf("--" + name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : def;
};
const PROJECT = opt("project", "pm3-luyenthi");
const DISPLAY = opt("name", "PM3 Luyen thi");
const DRIVE_FOLDER = opt("drive-folder", "");
const DRY = args.includes("--dry");
const FINISH = args.includes("--finish");

function cli(argv, { json = false } = {}) {
  const full = [CLI, ...argv, ...(json ? ["--json"] : [])];
  process.stdout.write("  $ firebase " + argv.join(" ") + "\n");
  const out = execFileSync(process.execPath, full, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (!json) return out;
  // Firebase in log trước JSON -> lấy object/array cuối cùng.
  const start = out.search(/^[\[{]/m);
  return JSON.parse(out.slice(start));
}

/** Chế độ --finish: giả định Firebase đã được bật trên Console, chỉ lấy appId. */
function finishMode() {
  console.log("\n[finsh] Kiểm tra project " + PROJECT);
  let cfg = {};
  try {
    const sdk = cli(["apps:sdkconfig", "WEB", "--project", PROJECT], { json: true });
    cfg = sdk.result || sdk;
  } catch (e) {
    console.log("  • Chưa có Web App, thử tạo…");
    try {
      cli(["apps:create", "WEB", "PM3 Web", "--project", PROJECT]);
      const sdk2 = cli(["apps:sdkconfig", "WEB", "--project", PROJECT], { json: true });
      cfg = sdk2.result || sdk2;
    } catch (e2) {
      console.error("\n✖ Không tạo được Web App.");
      console.error("  Nghĩa là Firebase CHƯA được bật cho project này.");
      console.error("  Hãy mở https://console.firebase.google.com/?project=" + PROJECT);
      console.error("  và bấm Continue/Add Firebase, rồi chạy lại lệnh này.\n");
      process.exit(1);
    }
  }
  const fb = {
    apiKey: cfg.apiKey || cfg.firebaseConfig?.apiKey || "",
    authDomain: cfg.authDomain || cfg.firebaseConfig?.authDomain || PROJECT + ".firebaseapp.com",
    projectId: cfg.projectId || cfg.firebaseConfig?.projectId || PROJECT,
    storageBucket: cfg.storageBucket || cfg.firebaseConfig?.storageBucket || PROJECT + ".firebasestorage.app",
    messagingSenderId: cfg.messagingSenderId || cfg.firebaseConfig?.messagingSenderId || "",
    appId: cfg.appId || cfg.firebaseConfig?.appId || ""
  };
  console.log("  ✓ appId = " + fb.appId);

  // Giữ nguyên API key Drive đã tạo nếu file cũ có.
  let driveKey = fb.apiKey;
  try {
    const old = fs.readFileSync(CONFIG_PATH, "utf8");
    const m = old.match(/apiKey:\s*"(AIza[^"]+)"/g);
    if (m && m.length > 1) {
      const km = m[m.length - 1].match(/"(AIza[^"]+)"/);
      if (km) driveKey = km[1];
    }
  } catch (e) {}

  const body = "window.PM3_CLOUD_CONFIG = {\n" +
"  enabled: true,\n\n" +
"  firebase: {\n" +
"    apiKey: " + JSON.stringify(fb.apiKey) + ",\n" +
"    authDomain: " + JSON.stringify(fb.authDomain) + ",\n" +
"    projectId: " + JSON.stringify(fb.projectId) + ",\n" +
"    storageBucket: " + JSON.stringify(fb.storageBucket) + ",\n" +
"    messagingSenderId: " + JSON.stringify(fb.messagingSenderId) + ",\n" +
"    appId: " + JSON.stringify(fb.appId) + "\n" +
"  },\n\n" +
"  oauthClientId: \"\",\n\n" +
"  drive: {\n" +
"    deckFolderId: " + JSON.stringify(DRIVE_FOLDER) + ",\n" +
"    apiKey: " + JSON.stringify(driveKey) + "\n" +
"  }\n" +
"};\n";
  if (DRY) console.log(body);
  else {
    fs.writeFileSync(CONFIG_PATH, body, "utf8");
    console.log("  ✓ Đã cập nhật " + CONFIG_PATH + " (enabled: true)");
  }
  console.log("\nHoàn tất! Chạy: npx --yes serve . -l 8778  →  http://localhost:8778\n");
}

function main() {
  if (!fs.existsSync(CLI)) {
    console.error("Không thấy Firebase CLI. Hãy chạy: npm install firebase-tools trong thư mục setup-tmp/");
    process.exit(1);
  }

  if (FINISH) return finishMode();

  console.log("\n[1/5] Kiểm tra đăng nhập");
  let listOut = "";
  try {
    listOut = cli(["login:list"]);
  } catch (e) {
    listOut = "";
  }
  if (/No authorized accounts/i.test(listOut)) {
    console.error("Chưa đăng nhập Firebase CLI. Hãy chạy:\n  cd setup-tmp\n  node node_modules/firebase-tools/lib/bin/firebase.js login\nSau đó chạy lại script này.");
    process.exit(1);
  }
  console.log("  ✓ " + listOut.trim().replace(/\n/g, " "));

  console.log("\n[2/5] Tạo project " + PROJECT);
  try {
    cli(["projects:create", PROJECT, "--display-name", DISPLAY]);
    console.log("  ✓ Đã tạo project");
  } catch (e) {
    console.log("  • Project có thể đã tồn tại, dùng lại.");
  }

  console.log("\n[3/5] Tạo Web App và lấy cấu hình");
  try {
    cli(["apps:create", "WEB", "PM3 Web", "--project", PROJECT]);
    console.log("  ✓ Đã tạo Web App");
  } catch (e) {
    console.log("  • Web App có thể đã tồn tại, dùng lại.");
  }
  let config = null;
  try {
    const sdk = cli(["apps:sdkconfig", "WEB", "--project", PROJECT], { json: true });
    config = sdk.result || sdk;
  } catch (e) {
    console.error("Không lấy được SDK config:", e.message);
    process.exit(1);
  }
  const fb = {
    apiKey: config.apiKey || config.firebaseConfig?.apiKey || "",
    authDomain: config.authDomain || config.firebaseConfig?.authDomain || `${PROJECT}.firebaseapp.com`,
    projectId: config.projectId || config.firebaseConfig?.projectId || PROJECT,
    storageBucket: config.storageBucket || config.firebaseConfig?.storageBucket || `${PROJECT}.firebasestorage.app`,
    messagingSenderId: config.messagingSenderId || config.firebaseConfig?.messagingSenderId || "",
    appId: config.appId || config.firebaseConfig?.appId || ""
  };
  console.log("  ✓ " + JSON.stringify({ projectId: fb.projectId, appId: fb.appId }));

  console.log("\n[4/5] Bật API (Identity Toolkit, Drive)");
  for (const svc of ["identitytoolkit.googleapis.com", "drive.googleapis.com"]) {
    try {
      cli(["services:enable", svc, "--project", PROJECT]);
      console.log("  ✓ " + svc);
    } catch (e) {
      console.log("  • " + svc + " (có thể đã bật)");
    }
  }

  console.log("\n[5/5] Ghi cấu hình");
  const body = `window.PM3_CLOUD_CONFIG = {
  enabled: true,

  firebase: {
    apiKey: ${JSON.stringify(fb.apiKey)},
    authDomain: ${JSON.stringify(fb.authDomain)},
    projectId: ${JSON.stringify(fb.projectId)},
    storageBucket: ${JSON.stringify(fb.storageBucket)},
    messagingSenderId: ${JSON.stringify(fb.messagingSenderId)},
    appId: ${JSON.stringify(fb.appId)}
  },

  // Để trống: dùng token Drive lấy trực tiếp qua Firebase (không cần OAuth client).
  oauthClientId: "",

  drive: {
    deckFolderId: ${JSON.stringify(DRIVE_FOLDER)},
    // API key của Drive (tuỳ chọn) — chỉ cần để đọc thư mục đề công khai.
    apiKey: ${JSON.stringify(fb.apiKey)}
  }
};
`;
  if (DRY) {
    console.log(body);
  } else {
    fs.writeFileSync(CONFIG_PATH, body, "utf8");
    console.log("  ✓ Đã ghi " + CONFIG_PATH);
  }

  console.log(`
Xong! Còn 2 việc phải làm trong trình duyệt (bắt buộc):
  1. https://console.firebase.google.com/project/${PROJECT}/authentication/providers
     → bật Google và Email/Password
  2. https://console.firebase.google.com/project/${PROJECT}/authentication/settings
     → Authorized domains: thêm localhost

Sau đó chạy:  npx --yes serve . -l 8778
Mở:          http://localhost:8778
`);
}

main();