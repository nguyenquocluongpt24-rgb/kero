/* ==========================================================================
   decks.js — Thư viện bộ đề
   --------------------------------------------------------------------------
   Có 2 nguồn đề, gộp lại thành một thư viện:

     1. CỤC BỘ  — thư mục `de/` (bundle .js do tools/build-de.mjs sinh ra).
                  Chạy được cả khi mở file:// hoặc không có mạng.

     2. GOOGLE DRIVE — nếu đã cấu hình trong cloud-config.js, app đọc danh sách
                  file .json trong thư mục Drive công khai và thêm vào thư viện.
                  Nguồn này cần http(s) + mạng.

   Quy ước miễn phí/thành viên:
     • Đề cục bộ : `free` lấy từ data/library.js (mặc định tên có "R7").
     • Đề Drive  : tự nhận diện — file có id/name chứa "R7" hoặc "(free)" là
                   miễn phí, còn lại cần MÃ KÍCH HOẠT thành viên.
   ========================================================================== */
(() => {
  "use strict";

  const sets = () => (window.PM3_SETS = window.PM3_SETS || {});

  /** Các bộ đề cục bộ (từ data/library.js). */
  function localList() {
    return Array.isArray(window.PM3_LIBRARY) ? window.PM3_LIBRARY.slice() : [];
  }

  /** Các bộ đề trên Drive đã tải (mảng rỗng nếu chưa cấu hình). */
  let driveItems = [];

  /** Toàn bộ bộ đề: Drive trước, rồi tới cục bộ. */
  function list() {
    return driveItems.concat(localList());
  }

  function entry(id) {
    return list().find((m) => m.id === id) || null;
  }

  /**
   * Bộ đề mặc định khi mở app: ưu tiên đề MIỄN PHÍ CỤC BỘ để app khởi động
   * được cả khi không có mạng; chỉ khi không có đề cục bộ mới dùng đề Drive.
   */
  function freeFirst() {
    const local = localList().find((m) => m.free === true);
    if (local) return local;
    return driveItems.find((m) => m.free === true) || localList()[0] || driveItems[0] || null;
  }

  function isUnlocked(item) {
    if (!item) return false;
    if (item.free === true) return true;
    return memberOn();
  }

  /**
   * Đề THÀNH VIÊN chỉ mở khi đã KÍCH HOẠT MÃ (cấp qua Zalo).
   * Đăng nhập (nếu có) KHÔNG mở khoá đề — người dùng phải đăng ký thành viên
   * và nhập mã kích hoạt trong hộp thoại Thành viên.
   */
  function memberOn() {
    const m = window.PM3Member;
    return !!(m && m.isMember && m.isMember());
  }

  /** Nhận diện đề miễn phí cho các file lấy từ Drive. */
  function looksFree(name, id) {
    const s = String(name || "") + " " + String(id || "");
    return /R7|free|miễn phí/i.test(s);
  }

  /* id -> Promise: mỗi nguồn chỉ nạp một lần. */
  const pending = {};

  /** Nạp nội dung một bộ đề cục bộ; trả về mảng câu hỏi thô. */
  function loadLocal(id) {
    if (pending[id]) return pending[id];
    pending[id] = new Promise((resolve, reject) => {
      const item = localList().find((m) => m.id === id);
      if (!item) return reject(new Error("Không có bộ đề: " + id));
      const cached = sets()[id];
      if (Array.isArray(cached) && cached.length) return resolve(cached);

      const script = document.createElement("script");
      script.src = item.bundle;
      script.async = true;
      script.onload = () => {
        const data = sets()[id];
        if (Array.isArray(data) && data.length) resolve(data);
        else reject(new Error("Bundle rỗng: " + item.bundle));
      };
      script.onerror = () => reject(new Error("Không nạp được " + item.bundle));
      document.head.appendChild(script);
    });
    pending[id].catch(() => { delete pending[id]; });
    return pending[id];
  }

  /** Nạp nội dung một bộ đề từ Drive. */
  function loadDrive(item) {
    if (pending[item.id]) return pending[item.id];
    pending[item.id] = (async () => {
      const c = window.PM3Cloud;
      if (!c || !c.fetchPublicDeck) throw new Error("Chưa cấu hình Google Drive.");
      return c.fetchPublicDeck(item.driveFileId);
    })();
    pending[item.id].catch(() => { delete pending[item.id]; });
    return pending[item.id];
  }

  function load(id) {
    const item = entry(id);
    if (!item) return Promise.reject(new Error("Không có bộ đề: " + id));
    return item.source === "drive" ? loadDrive(item) : loadLocal(id);
  }

  /**
   * Quét thư mục Drive công khai và cập nhật thư viện.
   * Trả về số bộ đề tìm thấy (0 nếu chưa cấu hình hoặc lỗi).
   */
  async function refreshDrive() {
    const c = window.PM3Cloud;
    if (!c || !c.canUseDriveRead || !c.canUseDriveRead()) return 0;
    try {
      const files = await c.listPublicDecks();
      driveItems = files
        .filter((f) => /\.json$/i.test(f.name))
        .map((f) => {
          const id = "drive:" + f.id;
          const name = f.name.replace(/\.json$/i, "");
          return {
            id,
            name,
            file: "drive:" + f.id,
            bundle: "",
            source: "drive",
            driveFileId: f.id,
            free: looksFree(name, f.id),
            count: 0,
            chapters: {},
            modifiedTime: f.modifiedTime || ""
          };
        });
      return driveItems.length;
    } catch (e) {
      driveItems = [];
      return 0;
    }
  }

  window.PM3Decks = { list, entry, freeFirst, isUnlocked, load, refreshDrive };
})();