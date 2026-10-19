/* ==========================================================================
   cloud.js — Đăng nhập Google (Firebase Auth) + lưu dữ liệu trên Google Drive
   --------------------------------------------------------------------------
   Kiến trúc "cloud tuỳ chọn":
     • Chưa cấu hình (assets/js/cloud-config.js → enabled:false):
         dùng tài khoản cục bộ trong assets/js/account.js như trước.
     • Đã cấu hình và đang mở bằng http(s):
         - Đăng nhập bằng Google hoặc Email/Mật khẩu qua Firebase Auth.
         - Dữ liệu học cá nhân lưu trong Drive (appDataFolder) của chính
           người dùng: file pm3-progress.json.
         - Bộ đề JSON trong Drive (thư mục công khai) được đọc bằng API key và
           đưa vào thư viện song song với thư mục de/ cục bộ.

   Mọi lời gọi đều có try/catch: nếu mạng lỗi, app tự quay về chế độ cục bộ
   để người học không bị chặn.
   ========================================================================== */
(() => {
  "use strict";

  const S = {
    ready: false,
    mode: "local", // "local" | "cloud"
    app: null,
    auth: null,
    user: null,
    oauthToken: null,
    oauthExpires: 0,
    loading: null
  };

  const cfg = window.PM3_CLOUD_CONFIG || {};
  const hasFirebase = () => !!(cfg.enabled && cfg.firebase && cfg.firebase.apiKey && cfg.firebase.projectId);
  /**
   * Chế độ "direct": đăng nhập Google bằng Google Identity Services, KHÔNG cần
   * Firebase. Phù hợp khi tài khoản Google chưa bật được Firebase/Identity
   * Platform (cần billing hoặc chấp nhận điều khoản). Chỉ cần OAuth Client ID.
   */
  const hasDirect = () => !!(cfg.enabled && cfg.oauthClientId);
  const hasDriveRead = () => !!(cfg.drive && cfg.drive.deckFolderId && cfg.drive.apiKey);

  /* ---------- Nạp SDK Firebase (compat) ---------- */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Không tải được " + src));
      document.head.appendChild(s);
    });
  }

  async function ensureFirebase() {
    if (!hasFirebase()) return false;
    if (S.app) return true;
    if (S.loading) return S.loading;

    S.loading = (async () => {
      await loadScript("https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js");
      await loadScript("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js");
      if (!window.firebase) throw new Error("Firebase SDK không khả dụng.");
      S.app = window.firebase.apps && window.firebase.apps.length
        ? window.firebase.app()
        : window.firebase.initializeApp(cfg.firebase);
      S.auth = window.firebase.auth();
      return true;
    })();

    try {
      return await S.loading;
    } catch (e) {
      S.loading = null;
      throw e;
    }
  }

  const isDirect = () => S.mode === "direct";

  /* ---------- Google OAuth (cho Drive) ---------- */
  const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
  const DRIVE_SCOPE_READ = "https://www.googleapis.com/auth/drive.readonly";
  const DIRECT_SCOPE = "openid email profile " + DRIVE_SCOPE;

  function loadGis() {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) return Promise.resolve();
    return loadScript("https://accounts.google.com/gsi/client");
  }

  /** Lấy access token Drive (dùng popup OAuth của Google Identity Services). */
  function getDriveToken(interactive) {
    if (S.oauthToken && Date.now() < S.oauthExpires - 60000) return Promise.resolve(S.oauthToken);
    if (!cfg.oauthClientId) return Promise.reject(new Error("Chưa cấu hình oauthClientId."));

    return loadGis().then(
      () =>
        new Promise((resolve, reject) => {
          try {
            const client = window.google.accounts.oauth2.initTokenClient({
              client_id: cfg.oauthClientId,
              scope: DRIVE_SCOPE,
              prompt: interactive ? "consent" : "",
              callback: (resp) => {
                if (resp && resp.access_token) {
                  S.oauthToken = resp.access_token;
                  S.oauthExpires = Date.now() + (Number(resp.expires_in || 3600) * 1000);
                  resolve(S.oauthToken);
                } else {
                  reject(new Error("Không lấy được quyền Google Drive."));
                }
              },
              error_callback: (err) => reject(new Error((err && err.type) || "OAuth bị huỷ."))
            });
            client.requestAccessToken({ prompt: interactive ? "consent" : "" });
          } catch (e) {
            reject(e);
          }
        })
    );
  }

  /* ---------- Drive: đọc bộ đề công khai ---------- */
  async function listPublicDecks() {
    if (!hasDriveRead()) return [];
    const q = encodeURIComponent(`'${cfg.drive.deckFolderId}' in parents and trashed = false and mimeType = 'application/json'`);
    const url =
      "https://www.googleapis.com/drive/v3/files?q=" + q +
      "&fields=files(id,name,size,modifiedTime)&pageSize=100&key=" + encodeURIComponent(cfg.drive.apiKey);
    const res = await fetch(url);
    if (!res.ok) throw new Error("Drive API: " + res.status);
    const data = await res.json();
    return (data.files || []).filter((f) => /\.json$/i.test(f.name));
  }

  async function fetchPublicDeck(fileId) {
    const url = "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(fileId) +
      "?alt=media&key=" + encodeURIComponent(cfg.drive.apiKey);
    const res = await fetch(url);
    if (!res.ok) throw new Error("Drive tải đề: " + res.status);
    return res.json();
  }

  /* ---------- Drive: dữ liệu riêng của người dùng ---------- */
  const PROGRESS_NAME = "pm3-progress.json";

  async function findAppFile(token, name) {
    const q = encodeURIComponent(`name = '${name}' and trashed = false`);
    const url = "https://www.googleapis.com/drive/v3/files?q=" + q +
      "&spaces=appDataFolder&fields=files(id,name,modifiedTime)&pageSize=1";
    const res = await fetch(url, { headers: { Authorization: "Bearer " + token } });
    if (!res.ok) throw new Error("Drive tìm file: " + res.status);
    const data = await res.json();
    return (data.files || [])[0] || null;
  }

  /** Tải dữ liệu học từ Drive. Trả về object hoặc null. */
  async function pullProgress() {
    const token = await getDriveToken(false);
    const meta = await findAppFile(token, PROGRESS_NAME);
    if (!meta) return null;
    const res = await fetch("https://www.googleapis.com/drive/v3/files/" + meta.id + "?alt=media", {
      headers: { Authorization: "Bearer " + token }
    });
    if (!res.ok) return null;
    return res.json();
  }

  /** Ghi dữ liệu học lên Drive (tạo mới hoặc cập nhật). */
  async function pushProgress(data) {
    const token = await getDriveToken(false);
    const meta = await findAppFile(token, PROGRESS_NAME);
    const body = JSON.stringify(data);
    if (meta) {
      const res = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files/" + meta.id + "?uploadType=media",
        { method: "PATCH", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body }
      );
      if (!res.ok) throw new Error("Drive cập nhật: " + res.status);
      return true;
    }
    const boundary = "pm3-" + Date.now();
    const metadata = { name: PROGRESS_NAME, parents: ["appDataFolder"] };
    const multipart =
      "--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" +
      JSON.stringify(metadata) + "\r\n" +
      "--" + boundary + "\r\nContent-Type: application/json\r\n\r\n" + body + "\r\n" +
      "--" + boundary + "--";
    const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "multipart/related; boundary=" + boundary },
      body: multipart
    });
    if (!res.ok) throw new Error("Drive tạo file: " + res.status);
    return true;
  }

  /* ---------- Firebase Auth ---------- */
  function mapUser(u) {
    if (!u) return null;
    return {
      username: u.uid,
      name: u.displayName || (u.email ? u.email.split("@")[0] : "Thành viên"),
      email: u.email || "",
      photo: u.photoURL || "",
      provider: (u.providerData && u.providerData[0] && u.providerData[0].providerId) || "firebase"
    };
  }

  async function signInGoogle() {
    await ensureFirebase();
    const provider = new window.firebase.auth.GoogleAuthProvider();
    // Xin luôn quyền Drive trong cùng một lần đăng nhập — không cần OAuth client riêng.
    provider.addScope(DRIVE_SCOPE);
    const cred = await S.auth.signInWithPopup(provider);
    captureDriveToken(cred);
    return mapUser(cred.user);
  }

  /** Lấy access token Drive từ kết quả đăng nhập Firebase (nếu có). */
  function captureDriveToken(cred) {
    try {
      const c = cred && cred.credential;
      const token = c && (c.accessToken || (c.idToken ? null : null));
      if (token) {
        S.oauthToken = token;
        // Firebase không trả expires_in; token thường sống ~1 giờ.
        S.oauthExpires = Date.now() + 55 * 60 * 1000;
      }
    } catch (e) {
      /* ignore */
    }
  }

  async function signInEmail(email, password) {
    await ensureFirebase();
    const cred = await S.auth.signInWithEmailAndPassword(email, password);
    return mapUser(cred.user);
  }

  /**
   * Với tài khoản email/mật khẩu, Drive cần một lần liên kết Google.
   * Ta dùng linkWithPopup để lấy access token Drive của chính người dùng.
   */
  async function linkGoogleForDrive(interactive) {
    await ensureFirebase();
    const u = S.auth.currentUser;
    if (!u) return false;
    const provider = new window.firebase.auth.GoogleAuthProvider();
    provider.addScope(DRIVE_SCOPE);
    try {
      const cred = await u.linkWithPopup(provider);
      captureDriveToken(cred);
      return !!S.oauthToken;
    } catch (e) {
      // Đã liên kết từ trước -> thử đăng nhập lại bằng popup để lấy token.
      try {
        const cred2 = await S.auth.signInWithPopup(provider);
        captureDriveToken(cred2);
        return !!S.oauthToken;
      } catch (e2) {
        return false;
      }
    }
  }

  async function signUpEmail(name, email, password) {
    await ensureFirebase();
    const cred = await S.auth.createUserWithEmailAndPassword(email, password);
    if (name && cred.user && cred.user.updateProfile) {
      await cred.user.updateProfile({ displayName: name });
    }
    // onAuthStateChanged có thể đã ghi S.user trước khi updateProfile xong;
    // gán lại hồ sơ (kèm tên vừa đặt) để giao diện hiện đúng ngay.
    const fresh = mapUser(S.auth.currentUser || cred.user);
    if (name) fresh.name = name;
    S.user = fresh;
    return fresh;
  }

  async function signOutCloud() {
    try {
      if (S.auth) await S.auth.signOut();
    } catch (e) {
      /* ignore */
    }
    S.oauthToken = null;
    S.oauthExpires = 0;
    S.user = null;
  }

  /* ---------- Quyền Drive ---------- */
  /**
   * Xin quyền Drive. `interactive=true` sẽ hiện hộp thoại đồng ý của Google
   * (chỉ nên gọi ngay sau một thao tác của người dùng, ví dụ sau khi đăng nhập).
   * Trả về true/false thay vì ném lỗi để app không bị chặn.
   */
  async function ensureDriveAccess(interactive) {
    if (S.oauthToken && Date.now() < S.oauthExpires - 60000) return true;
    // Cách 1 (khuyến nghị): lấy token qua Firebase — không cần OAuth client riêng.
    if (S.auth && S.auth.currentUser) {
      const ok = await linkGoogleForDrive(!!interactive);
      if (ok) return true;
    }
    // Cách 2 (dự phòng): dùng OAuth client ID nếu có cấu hình.
    if (!cfg.oauthClientId) return false;
    try {
      await getDriveToken(!!interactive);
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ---------- Chế độ direct (GIS) ---------- */
  const PROFILE_KEY = "pm3.profile.v1";

  function readProfile() {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
  function writeProfile(p) {
    try {
      if (p) localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
      else localStorage.removeItem(PROFILE_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  /** Đăng nhập Google trực tiếp (không Firebase). */
  async function signInDirect() {
    if (!hasDirect()) throw new Error("Chưa cấu hình oauthClientId trong cloud-config.js.");
    await loadGis();
    const token = await new Promise((resolve, reject) => {
      try {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: cfg.oauthClientId,
          scope: DIRECT_SCOPE,
          callback: (resp) => {
            if (resp && resp.access_token) resolve(resp);
            else reject(new Error("Không nhận được quyền truy cập."));
          },
          error_callback: (err) => reject(new Error((err && err.type) || "Đăng nhập bị huỷ."))
        });
        client.requestAccessToken({ prompt: "consent" });
      } catch (e) {
        reject(e);
      }
    });
    S.oauthToken = token.access_token;
    S.oauthExpires = Date.now() + Number(token.expires_in || 3600) * 1000 - 60000;

    // Lấy email + tên từ userinfo.
    let info = {};
    try {
      const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: "Bearer " + S.oauthToken }
      });
      if (res.ok) info = await res.json();
    } catch (e) {
      /* ignore */
    }
    const profile = {
      username: info.sub || info.email || "google",
      name: info.name || (info.email ? info.email.split("@")[0] : "Thành viên"),
      email: info.email || "",
      photo: info.picture || "",
      provider: "google-direct"
    };
    S.user = profile;
    writeProfile(profile);
    return profile;
  }

  function signOutDirect() {
    try {
      if (S.oauthToken && window.google && window.google.accounts && window.google.accounts.oauth2) {
        window.google.accounts.oauth2.revoke(S.oauthToken, () => {});
      }
    } catch (e) {
      /* ignore */
    }
    S.oauthToken = null;
    S.oauthExpires = 0;
    S.user = null;
    writeProfile(null);
  }

  /* ---------- Khởi tạo ---------- */
  async function init() {
    if (!hasFirebase()) {
      // Không có Firebase nhưng có OAuth Client ID -> dùng GIS trực tiếp.
      if (hasDirect() && typeof location !== "undefined" && location.protocol !== "file:") {
        S.mode = "direct";
        const saved = readProfile();
        S.user = saved;
      } else {
        S.mode = "local";
      }
      S.ready = true;
      return S;
    }
    // Firebase cần http(s); file:// sẽ rơi về chế độ cục bộ.
    if (typeof location !== "undefined" && location.protocol === "file:") {
      S.mode = "local";
      S.ready = true;
      return S;
    }
    try {
      await ensureFirebase();
      S.mode = "cloud";
      S.user = mapUser(S.auth.currentUser);
    } catch (e) {
      S.mode = "local";
    }
    S.ready = true;
    return S;
  }

  function onAuthChange(fn) {
    if (!S.auth) return;
    S.auth.onAuthStateChanged((u) => {
      S.user = mapUser(u);
      if (fn) fn(S.user);
    });
  }

  window.PM3Cloud = {
    get mode() {
      return S.mode;
    },
    get user() {
      return S.user;
    },
    get ready() {
      return S.ready;
    },
    isConfigured: hasFirebase,
    isDirect,
    signInDirect,
    signOutDirect,
    canUseDriveRead: hasDriveRead,
    init,
    onAuthChange,
    signInGoogle,
    signInEmail,
    signUpEmail,
    signOut: signOutCloud,
    ensureDriveAccess,
    linkGoogleForDrive,
    listPublicDecks,
    fetchPublicDeck,
    pullProgress,
    pushProgress
  };
})();