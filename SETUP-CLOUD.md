# Firebase Auth + Google Drive — đã bật xong

## Trạng thái hiện tại (đã cấu hình và kiểm chứng thực tế)

| Hạng mục | Giá trị |
|----------|---------|
| Project Firebase | `keroluong` (706835764957) |
| App ID | `1:706835764957:web:d56996d4c93a167d7b2d34` |
| Auth domain | `keroluong.firebaseapp.com` |
| API key | `AIzaSyB9pe05zvNTMfnsoPgSnlUqo2bt44MSODc` |
| Authorized domains | `localhost`, `127.0.0.1`, `192.168.2.130`, `keroluong.firebaseapp.com`, `keroluong.web.app` |
| Email/Password | ✅ đã bật và đã test tạo user thành công |
| Google Sign-in | ⚠️ cần bật 1 lần trên Console (xem dưới) |

Tiến trình đã tự động hoá: tạo/khôi phục project, gắn Firebase, khởi tạo
Identity Platform, bật Email/Password, thêm authorized domain, tạo Web App,
lấy SDK config và ghi vào `assets/js/cloud-config.js`.

---

## Bật Google Sign-in (1 lần, ~30 giây)

Google Sign-in cần cặp OAuth Client ID + Secret thật. Google chặn việc tạo
OAuth client qua API (403), nên phải bật trên Console. **Firebase sẽ tự tạo**
OAuth client cho bạn:

1. Mở https://console.firebase.google.com/project/keroluong/authentication/providers
2. Trong danh sách *Sign-in method*, bấm **Google**
3. Bật **Enable**, chọn email hỗ trợ, bấm **Save**

Xong. Nút **Đăng nhập bằng Google** trong app hoạt động ngay — không cần sửa file.

> Trước khi bật, người dùng vẫn đăng nhập bằng **Email + Mật khẩu** bình thường.

---

## Chạy

```powershell
cd "C:\Users\Kero Luong\Downloads\codexcode"
npx --yes serve . -l 8778
```

Mở http://localhost:8778 → bấm **Đăng nhập** → đăng ký hoặc đăng nhập.

> ⚠️ Phải dùng `http://localhost:8778`. Mở bằng `file://` sẽ chỉ chạy chế độ cục bộ.

---

## Dữ liệu lưu ở đâu

| Dữ liệu | Lưu tại |
|---------|---------|
| Mã kích hoạt thành viên | `localStorage` của thiết bị (`pm3.member.v1`) |
| Tài khoản, mật khẩu | Firebase Authentication (Google quản lý) |
| Tiến độ từng bộ đề | `localStorage` + Google Drive `pm3-progress.json` |
| Sổ từ vựng | `localStorage` + Drive (kèm tiến độ) |
| Bộ đề | thư mục `de/` hoặc thư mục Drive công khai |

> **Đăng nhập KHÔNG mở khoá đề.** Đề thành viên chỉ mở bằng **mã kích hoạt**
> (xem README mục 6). Đăng nhập chỉ để đồng bộ tiến độ giữa các thiết bị.

Tiến độ trên Drive nằm trong `appDataFolder` — riêng tư, không hiện trong
“My Drive”, chỉ ứng dụng của bạn đọc được.

---

## Kiểm thử đã chạy (tất cả PASS)

- Đăng ký bằng email → tài khoản tạo trên Firebase, tên hiển thị đúng
- Đăng nhập sai mật khẩu → “Email hoặc mật khẩu không đúng.”
- Đăng nhập đúng mật khẩu → vào được
- Đăng ký trùng email → “Email này đã được đăng ký…”
- Tải lại trang → Firebase tự khôi phục phiên đăng nhập
- Nhập mã kích hoạt hợp lệ → thẻ đề chuyển thành “Đã mở khoá”, mở được
- Huỷ mã kích hoạt → về khách, thẻ đề khoá lại; tải lại vẫn là khách
- Test cũ (từ vựng, furigana, nhập JSON) vẫn PASS

---

## Ghi chú: tài khoản email và Google Drive

Tài khoản đăng ký bằng **email/mật khẩu** chưa có token Google Drive. Khi cần
đồng bộ Drive, app sẽ yêu cầu liên kết Google một lần. Tài khoản đăng nhập
bằng **Google** được xin quyền Drive ngay sau khi đăng nhập.

Nếu chưa cấp quyền Drive, app vẫn lưu tiến độ trên máy — không mất dữ liệu,
chỉ là chưa đồng bộ giữa các thiết bị.

---

## Câu hỏi thường gặp

**Bấm Google báo lỗi cấu hình?**
Chưa bật Google provider trên Console (mục “Bật Google Sign-in” ở trên).

**Quên mật khẩu?**
Firebase Console → Authentication → Users → chọn user → Reset password.

**Muốn xoá tài khoản test?**
Firebase Console → Authentication → Users → ⋮ → Delete account.

**Muốn tắt đám mây?**
Đặt `enabled: false` trong `assets/js/cloud-config.js`.

**Đổi sang project Firebase khác?**
Sửa khối `firebase: { ... }` trong `cloud-config.js` bằng config mới.

---

## Sửa lỗi `auth/unauthorized-domain`

Lỗi này nghĩa là **địa chỉ bạn đang mở** chưa nằm trong danh sách domain
được Firebase cho phép. Danh sách hiện tại (đã kiểm chứng bằng API):

```
localhost
127.0.0.1
192.168.2.130
keroluong.firebaseapp.com
keroluong.web.app
```

### Cách kiểm tra nhanh

Mở hộp **Đăng nhập** — cuối hộp có dòng **“Domain đang dùng: …”**.
Đó chính là giá trị Firebase cần cho phép.

| Nếu dòng đó ghi | Cách xử lý |
|---|---|
| `localhost:8778` | ✅ Đã được phép — lỗi cũ có thể do cache, bấm Ctrl+F5 |
| `127.0.0.1:8778` | ✅ Đã được phép |
| `192.168.2.130:8778` | ✅ Đã được phép |
| `file://` | ❌ Phải chạy server, xem lệnh bên dưới |
| Tên miền khác | Thêm domain đó vào Firebase Console (bên dưới) |

### Thêm domain mới

1. Mở https://console.firebase.google.com/project/keroluong/authentication/settings
2. Mục **Authorized domains** → **Add domain**
3. Nhập đúng hostname (không kèm `http://` và không kèm cổng)
   - Ví dụ đúng: `localhost`, `192.168.2.130`, `pm3.example.com`
   - Ví dụ sai: `http://localhost:8778`
4. Save → chờ ~1 phút → tải lại trang (Ctrl+F5)

### Nếu bạn mở bằng IP LAN và vẫn lỗi

Google chỉ chấp nhận **hostname đã xác minh** cho một số cấu hình OAuth.
Cách chắc chắn nhất: dùng `localhost`.

```powershell
cd "C:\Users\Kero Luong\Downloads\codexcode"
npx --yes serve . -l 8778
```

Rồi mở đúng: **http://localhost:8778**

### Vẫn lỗi?

Bấm **F12 → Console**, chụp lại dòng lỗi và cho tôi biết nội dung dòng
**“Domain đang dùng”** — tôi sẽ thêm domain đó vào Firebase cho bạn.


---

## Đưa web lên mạng (tên miền cố định)

Để người khác dùng được, chạy:

```powershell
cd "C:\Users\Kero Luong\Downloads\codexcode"
npx --yes firebase-tools deploy --only hosting --project keroluong
```

Web sẽ có tại **https://keroluong.web.app** (và `https://keroluong.firebaseapp.com`).

`localhost` luôn được Firebase cho phép sẵn; tên miền riêng (nếu gắn) phải thêm
vào **Authentication → Settings → Authorized domains** thì nút đăng nhập Google
mới hoạt động.

Mã kích hoạt **không phụ thuộc tên miền** — mã tạo bằng `tools/gen-code.mjs`
dùng được ở mọi nơi.
