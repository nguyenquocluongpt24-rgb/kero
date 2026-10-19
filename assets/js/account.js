/* ==========================================================================
   account.js — Tài khoản thành viên
   --------------------------------------------------------------------------
   Có 2 chế độ, tự chọn theo cấu hình trong assets/js/cloud-config.js:

     1) CLOUD (khuyến nghị) — Firebase Authentication:
          • Đăng nhập bằng Google (một cú bấm).
          • Hoặc Email + Mật khẩu (do Firebase quản lý, mật khẩu không nằm
            trong máy người dùng).
          • Dữ liệu học lưu trên Google Drive của chính người dùng.

     2) LOCAL (dự phòng) — khi chưa cấu hình cloud hoặc mở bằng file://:
          • Tài khoản lưu trong localStorage của máy.
          • CHỈ để mở khoá nội dung, KHÔNG phải bảo mật thật.

   Giao diện gọi qua window.PM3Account như cũ, nên phần còn lại của app không
   cần biết đang chạy chế độ nào.
   ========================================================================== */
(() => {
  "use strict";

  const USERS = "pm3.users.v1";
  const SESSION = "pm3.session.v1";
  const SESSION_DAYS = 30;

  /* ---------- Storage helpers ---------- */
  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* storage đầy / chế độ riêng tư — bỏ qua */
    }
  }

  function users() {
    const u = read(USERS, {});
    return u && typeof u === "object" ? u : {};
  }

  /* ---------- Băm mật khẩu cho chế độ cục bộ ---------- */
  function hash(text) {
    let h = 5381;
    const s = String(text);
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(16);
  }
  function salt() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }
  function scramble(password, saltValue) {
    let out = hash(saltValue + ":" + password);
    for (let i = 0; i < 500; i++) out = hash(out + saltValue);
    return out;
  }

  /* ---------- Chế độ cloud ---------- */
  function cloud() {
    return window.PM3Cloud || null;
  }
  /** Đang dùng Firebase Auth? */
  function isCloud() {
    const c = cloud();
    return !!(c && c.isConfigured && c.isConfigured() && c.mode === "cloud");
  }

  /** Đang dùng Google Identity Services (không Firebase)? */
  function isDirect() {
    const c = cloud();
    return !!(c && c.isDirect && c.isDirect());
  }

  /** Có đăng nhập qua Google (cloud hoặc direct) không. */
  function isOnline() {
    return isCloud() || isDirect();
  }

  /* ---------- Phiên cục bộ ---------- */
  function currentSession() {
    const s = read(SESSION, null);
    if (!s || typeof s !== "object" || !s.username) return null;
    if (s.expires && Date.now() > s.expires) {
      try {
        localStorage.removeItem(SESSION);
      } catch (e) {
        /* ignore */
      }
      return null;
    }
    return s;
  }

  /** Người dùng hiện tại (cloud ưu tiên hơn cục bộ). */
  function user() {
    if (isCloud() || isDirect()) return cloud().user || null;
    const s = currentSession();
    if (!s) return null;
    const u = users()[s.username];
    if (!u) return null;
    return { username: s.username, name: u.name || s.username, email: u.email || "", photo: "" };
  }

  /* ---------- Sự kiện ---------- */
  const listeners = [];
  function emit() {
    const u = user();
    listeners.forEach((fn) => {
      try {
        fn(u);
      } catch (e) {
        /* ignore */
      }
    });
  }
  function onChange(fn) {
    if (typeof fn === "function") listeners.push(fn);
  }

  /* ---------- Kiểm tra ---------- */
  const norm = (v) => String(v || "").trim().toLowerCase();
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  async function register({ username, email, password, password2 }) {
    if (isDirect()) {
      return { ok: false, error: "Chế độ này chỉ hỗ trợ đăng nhập bằng Google. Hãy bấm nút Google." };
    }
    const pass = String(password || "");
    if (pass.length < 6) return { ok: false, error: "Mật khẩu cần ít nhất 6 ký tự." };
    if (password2 !== undefined && pass !== String(password2 || ""))
      return { ok: false, error: "Hai lần nhập mật khẩu không khớp." };

    if (isCloud()) {
      const mail = String(email || "").trim();
      if (!EMAIL_RE.test(mail)) return { ok: false, error: "Hãy nhập email hợp lệ để tạo tài khoản." };
      try {
        await cloud().signUpEmail(String(username || "").trim(), mail, pass);
        emit();
        return { ok: true, cloud: true };
      } catch (e) {
        return { ok: false, error: firebaseError(e) };
      }
    }

    // ---- Chế độ cục bộ ----
    const uname = norm(username);
    if (uname.length < 3) return { ok: false, error: "Tên đăng nhập cần ít nhất 3 ký tự." };
    if (!/^[a-z0-9._-]+$/.test(uname))
      return { ok: false, error: "Tên đăng nhập chỉ gồm chữ thường, số và . _ -" };
    const mail = String(email || "").trim();
    if (mail && !EMAIL_RE.test(mail)) return { ok: false, error: "Email không hợp lệ." };

    const all = users();
    if (all[uname]) return { ok: false, error: "Tên đăng nhập này đã tồn tại trên máy bạn." };

    const s = salt();
    all[uname] = { name: String(username).trim(), email: mail, salt: s, pass: scramble(pass, s), createdAt: Date.now() };
    write(USERS, all);
    startSession(uname);
    return { ok: true };
  }

  async function login({ username, password }) {
    if (isDirect()) {
      return { ok: false, error: "Chế độ này chỉ hỗ trợ đăng nhập bằng Google. Hãy bấm nút Google." };
    }

    if (isCloud()) {
      const mail = String(username || "").trim();
      if (!EMAIL_RE.test(mail))
        return { ok: false, error: "Ở chế độ cloud, hãy đăng nhập bằng email (hoặc dùng nút Google)." };
      try {
        await cloud().signInEmail(mail, String(password || ""));
        emit();
        return { ok: true, cloud: true };
      } catch (e) {
        return { ok: false, error: firebaseError(e) };
      }
    }

    // ---- Chế độ cục bộ ----
    const uname = norm(username);
    const all = users();
    const acc = all[uname];
    if (!acc) return { ok: false, error: "Không tìm thấy tài khoản này trên máy bạn." };
    if (scramble(String(password || ""), acc.salt) !== acc.pass)
      return { ok: false, error: "Mật khẩu không đúng." };
    startSession(uname);
    return { ok: true };
  }

  /** Đăng nhập bằng Google (chỉ có ở chế độ cloud). */
  async function loginWithGoogle() {
    try {
      if (isDirect()) {
        await cloud().signInDirect();
        emit();
        return { ok: true, direct: true };
      }
      if (!isCloud()) return { ok: false, error: "Chưa cấu hình đăng nhập Google trong cloud-config.js." };
      await cloud().signInGoogle();
      emit();
      return { ok: true, cloud: true };
    } catch (e) {
      return { ok: false, error: googleError(e) };
    }
  }

  /** Lỗi đăng nhập Google ở chế độ direct. */
  function googleError(e) {
    const msg = String((e && e.message) || e || "");
    if (/popup_closed|access_denied|user_cancel/i.test(msg)) return "Bạn đã huỷ đăng nhập Google.";
    if (/origin|redirect_uri|invalid_client/i.test(msg))
      return "OAuth Client ID chưa cho phép địa chỉ này. Thêm http://localhost:8778 vào Authorized JavaScript origins.";
    if (/Failed to fetch|network/i.test(msg)) return "Không kết nối được Google. Kiểm tra mạng rồi thử lại.";
    return "Đăng nhập Google không thành công: " + msg;
  }

  function startSession(username) {
    write(SESSION, { username, at: Date.now(), expires: Date.now() + SESSION_DAYS * 86400000 });
    emit();
  }

  function logout() {
    if (isDirect() && cloud() && cloud().signOutDirect) {
      cloud().signOutDirect();
      emit();
      return;
    }
    if (isCloud() && cloud()) {
      cloud().signOut().finally(() => emit());
      return;
    }
    try {
      localStorage.removeItem(SESSION);
    } catch (e) {
      /* ignore */
    }
    emit();
  }

  /** Thông báo lỗi Firebase bằng tiếng Việt. */
  function firebaseError(e) {
    const code = (e && (e.code || e.message)) || "";
    if (/auth\/email-already-in-use/.test(code)) return "Email này đã được đăng ký. Hãy dùng chức năng đăng nhập.";
    if (/auth\/invalid-email/.test(code)) return "Email không hợp lệ.";
    if (/auth\/weak-password/.test(code)) return "Mật khẩu quá yếu (tối thiểu 6 ký tự).";
    if (/auth\/user-not-found/.test(code)) return "Chưa có tài khoản với email này.";
    if (/auth\/wrong-password|auth\/invalid-credential/.test(code)) return "Email hoặc mật khẩu không đúng.";
    if (/auth\/too-many-requests/.test(code)) return "Bạn thử quá nhiều lần. Vui lòng đợi vài phút.";
    if (/auth\/popup-closed-by-user|cancelled-popup-request/.test(code)) return "Bạn đã đóng cửa sổ đăng nhập Google.";
    if (/auth\/unauthorized-domain/.test(code)) {
      const host = (typeof location !== "undefined" && location.hostname) || "tên miền này";
      return "Tên miền \"" + host + "\" chưa được Firebase cho phép. Vào Firebase Console → Authentication → Settings → Authorized domains → Add domain → \"" + host + "\". Hoặc mở web bằng http://localhost:8778 (đã cho phép sẵn).";
    }
    if (/auth\/operation-not-allowed/.test(code))
      return "Phương thức đăng nhập này chưa được bật trong Firebase Console.";
    if (/api-key-not-valid|invalid-api-key/i.test(code))
      return "API key trong cloud-config.js không đúng hoặc chưa bật Firebase Authentication.";
    if (/configuration-not-found|project-not-found/i.test(code))
      return "Chưa tìm thấy dự án Firebase. Kiểm tra projectId trong cloud-config.js.";
    if (/network|Failed to fetch|timeout/i.test(code)) return "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.";
    if (/internal-error/i.test(code)) return "Máy chủ đăng nhập đang bận. Vui lòng thử lại sau ít phút.";
    return "Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin và thử lại.";
  }

  window.PM3Account = {
    user,
    register,
    login,
    loginWithGoogle,
    logout,
    onChange,
    isCloud,
    isDirect,
    isOnline,
    refresh: emit
  };
})();