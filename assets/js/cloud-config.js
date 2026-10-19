/* ==========================================================================
   cloud-config.js — CẤU HÌNH ĐÁM MÂY (Firebase Auth + Google Drive)
   --------------------------------------------------------------------------
   ĐÃ CẤU HÌNH TỰ ĐỘNG VÀ KIỂM CHỨNG THỰC TẾ

     Project Firebase : keroluong  (706835764957)
     App ID           : 1:706835764957:web:d56996d4c93a167d7b2d34
     Auth Domain      : keroluong.firebaseapp.com
     Đã bật          : Email/Password  (đã test tạo user thành công)
     Authorized domain: localhost + keroluong.firebaseapp.com + keroluong.web.app

   ĐĂNG NHẬP GOOGLE:
     Firebase cần OAuth Client ID + Secret thật cho Google Sign-in.
     Việc tạo OAuth client bị Google chặn qua API (403), nên phải tạo tay 1 lần:
       https://console.firebase.google.com/project/keroluong/authentication/providers
       → chọn Google → Enable → Save (Firebase tự tạo OAuth client)
     Sau đó nút 'Đăng nhập bằng Google' sẽ hoạt động ngay, không cần sửa file.
     Trước đó, người dùng vẫn đăng nhập được bằng Email + Mật khẩu.
   ========================================================================== */
window.PM3_CLOUD_CONFIG = {
  enabled: true,

  firebase: {
    apiKey: "AIzaSyB9pe05zvNTMfnsoPgSnlUqo2bt44MSODc",
    authDomain: "keroluong.firebaseapp.com",
    projectId: "keroluong",
    storageBucket: "keroluong.firebasestorage.app",
    messagingSenderId: "706835764957",
    appId: "1:706835764957:web:d56996d4c93a167d7b2d34"
  },

  // Để trống: app lấy quyền Drive trực tiếp qua Firebase (không cần OAuth client riêng).
  oauthClientId: "",

  drive: {
    deckFolderId: "",
    apiKey: "AIzaSyB9pe05zvNTMfnsoPgSnlUqo2bt44MSODc"
  }
};
