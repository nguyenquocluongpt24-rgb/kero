/* ==========================================================================
   membership.js — Thành viên & mã kích hoạt
   --------------------------------------------------------------------------
   MÔ HÌNH:
     • Bộ đề MIỄN PHÍ (R7)  : ai cũng mở được.
     • Bộ đề THÀNH VIÊN     : chỉ mở khi đã KÍCH HOẠT MÃ do chủ web cấp.
       Người dùng liên hệ Zalo để đăng ký, nhận mã, rồi nhập vào web.

   Đăng nhập (nếu có) KHÔNG mở khoá đề. Chỉ mã kích hoạt mới mở khoá.

   MÃ KÍCH HOẠT có dạng:
       PM3-<tên>.<YYMMDD>-<chữ ký 6 ký tự>
   Ví dụ:
       PM3-nguyenquocluong.261231-A7K2M9
     - <tên>    : tên thành viên (chữ thường, không dấu, có thể bỏ trống)
     - <YYMMDD> : ngày hết hạn
     - <chữ ký> : HMAC-SHA256 của (tên + ngày hết hạn) với khoá bí mật

   Tạo mã ở máy chủ của bạn:
       node tools/gen-code.mjs --name "nguyen quoc luong" --days 365

   ⚠ LƯU Ý BẢO MẬT
     Đây là web TĨNH (không có máy chủ), nên khoá bí mật nằm ngay trong mã
     nguồn và người rành kỹ thuật có thể đọc được. Mã kích hoạt đủ để chặn
     người dùng thông thường copy đề, KHÔNG phải bảo vệ tuyệt đối. Nếu cần
     chống copy mạnh hơn, phải chuyển sang máy chủ thật.
   ========================================================================== */
(() => {
  "use strict";

  const STATE_KEY = "pm3.member.v1";

  // Khoá bí mật — PHẢI giống hệt SECRET trong tools/gen-code.mjs
  const SECRET = "PM3-2026-KERO-LUONG-生产管理-3級-7f3a91";

  /* ---------- Tiện ích ---------- */
  function read() {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function write(v) {
    try {
      if (v) localStorage.setItem(STATE_KEY, JSON.stringify(v));
      else localStorage.removeItem(STATE_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  /** Bỏ dấu tiếng Việt + chuẩn hoá để so khớp tên. */
  function fold(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function toHex(buf) {
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  }

  /** HMAC-SHA256 -> 6 ký tự đầu (dùng Web Crypto). */
  async function sign(nameKey, expiry) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const mac = await crypto.subtle.sign("HMAC", key, enc.encode(nameKey + "|" + expiry));
    return toHex(mac).slice(0, 6);
  }

  /** YYMMDD -> đối tượng Date (cuối ngày, giờ Việt Nam ~ UTC+7). */
  function expiryDate(yymmdd) {
    const yy = Number(yymmdd.slice(0, 2));
    const mm = Number(yymmdd.slice(2, 4));
    const dd = Number(yymmdd.slice(4, 6));
    const year = 2000 + yy;
    const d = new Date(Date.UTC(year, mm - 1, dd, 23, 59, 59));
    return isNaN(d.getTime()) ? null : d;
  }

  /* ---------- Trạng thái ---------- */
  /**
   * Thông tin thành viên đang kích hoạt, hoặc null.
   * Trả về { name, expiry, expiresAt, activatedAt }.
   */
  function info() {
    const st = read();
    if (!st || !st.expiry) return null;
    const d = expiryDate(st.expiry);
    if (!d) return null;
    if (Date.now() > d.getTime()) return null; // hết hạn
    return { name: st.name || "", expiry: st.expiry, expiresAt: d.getTime(), activatedAt: st.activatedAt || 0 };
  }

  function isMember() {
    return !!info();
  }

  /** Số ngày còn lại (làm tròn lên). */
  function daysLeft() {
    const m = info();
    if (!m) return 0;
    return Math.max(0, Math.ceil((m.expiresAt - Date.now()) / 86400000));
  }

  /**
   * Kích hoạt mã. Trả về { ok:true, member } hoặc { ok:false, error }.
   */
  /**
   * Tách mã thành 3 phần, GIỮ NGUYÊN chữ hoa/thường của tên để hiển thị đẹp.
   *   • Có tên : PM3-<tên>.<YYMMDD>-<chữ ký>   (tên có thể chứa dấu cách)
   *   • Không tên: PM3-<YYMMDD>-<chữ ký>
   * Dùng khớp KHÔNG tham lam (.*?) để dấu "." ngăn cách không bị ăn vào tên.
   */
  function parse(code) {
    const original = String(code || "").trim().replace(/\s+/g, " ");
    if (!original) return null;
    let m = original.match(/^PM3-(.*?)\.(\d{6})-([A-Za-z0-9]{6})$/i);
    if (m) {
      const display = m[1].trim().replace(/\.+$/, "").replace(/\s+/g, " ");
      return { display, expiry: m[2], sig: m[3].toUpperCase() };
    }
    m = original.match(/^PM3-(\d{6})-([A-Za-z0-9]{6})$/i);
    if (m) return { display: "", expiry: m[1], sig: m[2].toUpperCase() };
    return null;
  }

  /**
   * Kích hoạt mã. Trả về { ok:true, member } hoặc { ok:false, error }.
   */
  async function activate(code) {
    const parsed = parse(code);
    if (!parsed) {
      return { ok: false, error: "Mã không đúng định dạng. Ví dụ: PM3-tenban.261231-A7K2M9" };
    }
    const nameRaw = parsed.display;
    const expiry = parsed.expiry;
    const sig = parsed.sig;

    // Chữ ký luôn tính trên dạng đã chuẩn hoá (bỏ dấu, chữ thường) nên người
    // dùng gõ hoa/thường hay có dấu đều được.
    const nameKey = nameRaw === "" ? "PM3" : fold(nameRaw);
    const expect = await sign(nameKey, expiry);
    if (expect !== sig) {
      return { ok: false, error: "Mã không hợp lệ. Hãy kiểm tra lại hoặc liên hệ Zalo để được cấp lại." };
    }
    const d = expiryDate(expiry);
    if (!d) return { ok: false, error: "Ngày hết hạn trong mã không hợp lệ." };
    if (Date.now() > d.getTime()) {
      return { ok: false, error: "Mã đã hết hạn. Vui lòng liên hệ Zalo để gia hạn." };
    }

    const member = {
      name: nameRaw,
      expiry,
      activatedAt: Date.now(),
      code: rawCode(nameRaw, expiry, sig)
    };
    write(member);
    emit();
    return { ok: true, member: info() };
  }

  /** Dựng lại mã chuẩn (để hiển thị / sao lưu). */
  function rawCode(name, expiry, sig) {
    return "PM3-" + (name ? name + "." : "") + expiry + "-" + sig;
  }

  function deactivate() {
    write(null);
    emit();
  }

  /* ---------- Sự kiện ---------- */
  const listeners = [];
  function emit() {
    const m = info();
    listeners.forEach((fn) => {
      try {
        fn(m);
      } catch (e) {
        /* ignore */
      }
    });
  }
  function onChange(fn) {
    if (typeof fn === "function") listeners.push(fn);
  }

  /* ---------- Liên hệ ---------- */
  const ZALO_PHONE = "819035694340"; // +81 90-3569-4340
  const ZALO_URL = "https://zalo.me/" + ZALO_PHONE;
  const ZALO_DISPLAY = "+81 90 3569 4340";

  window.PM3Member = {
    info,
    isMember,
    daysLeft,
    activate,
    deactivate,
    onChange,
    fold,
    ZALO_URL,
    ZALO_PHONE,
    ZALO_DISPLAY,
    /** Mã gợi ý nội dung nhắn Zalo. */
    contactMessage(deckName) {
      return "Chào anh/chị, em muốn đăng ký thành viên web luyện thi 生産管理 3級" +
        (deckName ? " để mở bộ đề: " + deckName : "") + ". Nhờ anh/chị cấp mã kích hoạt.";
    }
  };
})();