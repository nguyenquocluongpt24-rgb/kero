# 生産管理オペレーション3級 — Web luyện thi (giao diện cốt lõi)

Ứng dụng tĩnh (HTML/CSS/JavaScript thuần, **không cần build, không cần cài đặt**) giúp luyện thi
`ビジネスキャリア検定 生産管理オペレーション 3級` theo đúng 10 chương, chấm điểm tức thì và hiển thị
giải thích – bẫy – kiến thức cốt lõi – từ vựng cho từng câu.

---

## 1. Cấu trúc thư mục

```
codexcode/
├─ index.html                     # Khung giao diện (sidebar + topbar + các view + modal)
├─ README.md
├─ assets/
│  ├─ css/styles.css              # Toàn bộ style: theme sáng/tối, responsive
│  └─ js/app.js                   # Toàn bộ logic: tải dữ liệu, luyện tập, chấm điểm, lưu tiến độ
└─ data/
   ├─ questions.json              # Bộ đề thật của bạn (JSON thuần)
   ├─ questions-data.js           # Cùng nội dung, dạng JS — để app chạy được cả khi mở file://
   ├─ demo-questions.js           # Bộ 12 câu mẫu (dự phòng)
   └─ demo-questions.json         # Nội dung y hệt, dạng JSON thuần
```

## 2. Cách chạy

**Cách A — mở trực tiếp:** bấm đúp vào `index.html`. App chạy ngay với bộ đề thật
(`data/questions-data.js` được nạp kèm vì trình duyệt chặn `fetch` file JSON khi mở bằng `file://`).

**Cách B — chạy qua server (khuyến nghị khi bạn có file `data/questions.json`):**

```powershell
cd "C:\Users\Kero Luong\Downloads\codexcode"
npx --yes serve .        # hoặc: python -m http.server 8080
```

Sau đó mở `http://localhost:3000`. Khi chạy qua `http(s)://`, app sẽ tự động nạp
`data/questions.json` nếu file này tồn tại. Khi mở bằng `file://`, trình duyệt chặn `fetch`
nên app tự chuyển sang `data/questions-data.js` (cùng nội dung, dạng JS): vẫn đủ 40 câu, không cần nhập lại.
Nút **Nhập JSON** chỉ cần khi bạn muốn thay bằng bộ đề khác.

## 3. Nạp bộ đề của bạn (2 cách)

1. **Đặt file:** lưu database của bạn thành `data/questions.json` → chạy qua server (Cách B).
2. **Nhập trực tiếp trên web:** bấm **Nhập JSON** ở thanh trên → kéo–thả hoặc chọn file JSON.
   Dữ liệu được kiểm tra cấu trúc, lưu vào `localStorage` và dùng ngay (không gửi lên mạng).
   Nút **Dùng lại dữ liệu mẫu** để khôi phục.

> **Quan trọng:** khi bạn sửa `data/questions.json`, hãy cập nhật luôn `data/questions-data.js`
> để bản mở trực tiếp (`file://`) dùng đúng dữ liệu mới — hoặc đơn giản là dùng nút **Nhập JSON**.
>
> Mẹo: `data/demo-questions.json` là ví dụ đúng cấu trúc bạn mô tả.

## 4. Cấu trúc JSON (đúng như bạn yêu cầu)

```json
[
  {
    "id": "01",
    "chapter": "6.作業管理",
    "question": { "japanese": "…", "vietnamese": "…" },
    "options": [
      { "key": "ア", "japanese": "…", "vietnamese": "…" },
      { "key": "イ", "japanese": "…", "vietnamese": "…" },
      { "key": "ウ", "japanese": "…", "vietnamese": "…" },
      { "key": "エ", "japanese": "…", "vietnamese": "…" }
    ],
    "correct_answer": "イ",
    "explanation": {
      "correct_reason": "…",
      "incorrect_reasons": { "ア": "…", "イ": "…", "ウ": "…", "エ": "…" }
    },
    "key_knowledge": ["…"],
    "exam_traps": ["…"],
    "vocabulary": [ { "word": "…", "reading": "…", "meaning": "…" } ]
  }
]
```

**Trường `chapter` linh hoạt:** app nhận `"6.作業管理"`, `"6. 作業管理"`, `"作業管理"`, `"6"`…
và tự ánh xạ vào 10 chương chuẩn:

| # | Chương | Tiếng Việt |
|---|--------|-----------|
| 01 | 品質管理 | Quản lý chất lượng |
| 02 | 原価管理 | Quản lý chi phí |
| 03 | 納期管理 | Quản lý thời hạn giao hàng |
| 04 | 安全衛生 | An toàn & vệ sinh lao động |
| 05 | 環境管理 | Quản lý môi trường |
| 06 | 作業管理 | Quản lý công việc |
| 07 | 工程管理 | Quản lý công đoạn |
| 08 | 設備管理 | Quản lý thiết bị |
| 09 | 資材・在庫管理 | Quản lý vật tư & tồn kho |
| 10 | 運搬・物流管理 | Quản lý vận chuyển & logistics |

Khi nhập file, app sẽ báo lỗi cụ thể (câu số mấy, thiếu `id` / `correct_answer` không khớp đáp án / `id` trùng…).

## 5. Tính năng của giao diện cốt lõi

- **Tổng quan:** vòng tròn tiến độ tổng, thống kê (tổng câu, đã làm, độ chính xác, số câu cần ôn lại),
  lưới 10 chương với % hoàn thành từng chương.
- **Luyện tập:** chọn đáp án → **Kiểm tra đáp án** → tô xanh đáp án đúng / đỏ đáp án đã chọn sai,
  kèm khối giải thích: vì sao đúng, vì sao từng phương án sai, kiến thức cốt lõi, bẫy thường gặp, từ vựng.
- **Chế độ luyện:** toàn bộ đề, theo từng chương, **Câu làm sai** (tổng hợp), **Đã lưu** (bookmark).
- **Bảng câu hỏi (palette):** nhảy nhanh tới bất kỳ câu nào, thấy trạng thái đúng/sai/đang làm.
- **Kết quả lượt luyện:** điểm %, số câu đúng, thời gian, kết quả theo từng chương,
  danh sách câu sai (bấm để xem lại) + nút **Luyện lại N câu sai**.
- **Lưu tiến độ tự động** vào `localStorage`: số lần làm, số lần đúng, đáp án gần nhất, bookmark, theme, phiên đang làm dở.
- **Sổ từ vựng:** mỗi từ trong khối từ vựng sau khi chấm bài có nút **dấu trang** để lưu vào sổ (bấm lần nữa để bỏ lưu). Sổ từ vựng
  (mục **Sổ từ vựng** ở sidebar) hiển thị câu tiếng Nhật + câu dịch, tự động xuống dòng khi câu dài,
  cho phép **tìm kiếm** (không dấu vẫn khớp tiếng Việt), **xuất CSV** (`so-tu-vung.csv`, mở tốt trong Excel)
  và **xoá toàn bộ**. Lưu cùng một từ lần nữa sẽ bỏ lưu (không trùng lặp).
- **Giao diện sáng/tối**, nút **Bản dịch ON/OFF** để ẩn/hiện tiếng Việt và nút **Furigana** để ẩn/hiện
  phiên âm cách đọc trên chữ Hán (luyện đọc đề tiếng Nhật), responsive tới mobile.

## 6. Thành viên & mã kích hoạt (quan trọng)

Mô hình khoá đề:

| Loại bộ đề | Điều kiện mở |
|-----------|--------------|
| **Miễn phí** (tên file có `R7`, hoặc `free: true` trong `data/library.js`) | Mở cho tất cả mọi người |
| **Thành viên** (các bộ còn lại, ví dụ `JSON_R6_Zenki`) | Phải **kích hoạt mã** do chủ web cấp |

> **Đăng nhập KHÔNG mở khoá đề.** Đăng nhập chỉ dùng để đồng bộ tiến độ học
> giữa các thiết bị. Muốn mở đề thành viên, người dùng phải có **mã kích hoạt**.

### Quy trình đăng ký thành viên

1. Người dùng bấm **Kích hoạt mã** (nút trên thanh trên cùng, hoặc trong Thư viện bộ đề).
2. Trong hộp thoại có nút **Nhắn Zalo để đăng ký** → mở Zalo tới **+81 90 3569 4340**.
3. Bạn (chủ web) tạo mã và gửi lại cho người dùng.
4. Người dùng dán mã vào ô **Mã kích hoạt** → bấm **Kích hoạt**.
5. Toàn bộ đề thành viên mở khoá trên thiết bị đó, đến hết hạn ghi trong mã.

### Tạo mã kích hoạt (dành cho chủ web)

```powershell
cd "C:\Users\Kero Luong\Downloads\codexcode"

# Một thành viên, hạn 1 năm
node tools/gen-code.mjs --name "nguyen van a" --days 365

# Hết hạn theo ngày cụ thể
node tools/gen-code.mjs --name "tran thi b" --until 2027-06-30

# Cấp cho cả lớp: 20 mã riêng, hạn 30 ngày
node tools/gen-code.mjs --name "lop-k35" --days 30 --count 20

# Mã dùng chung, không gắn tên
node tools/gen-code.mjs --days 30
```

Mã có dạng `PM3-<tên>.<YYMMDD>-<chữ ký>`:

```
PM3-nguyen van a.271019-7A4155
 │   │            │      └─ chữ ký HMAC-SHA256 (6 ký tự)
 │   │            └──────── ngày hết hạn YYMMDD (19/10/2027)
 │   └───────────────────── tên thành viên (giữ nguyên chữ hoa/thường)
 └───────────────────────── tiền tố
```

- Tên **không bắt buộc**; nếu có thì hiển thị trong hồ sơ và ghi chú thư viện.
- Người dùng gõ hoa/thường hay có dấu đều được — chữ ký tính trên dạng đã chuẩn hoá.
- Hết hạn: mã bị từ chối, cần cấp mã mới (gia hạn).
- Mã lưu trong `localStorage` của thiết bị (`pm3.member.v1`), có nút **Huỷ** để xoá.

> ⚠️ **Bảo mật:** đây là web tĩnh nên khoá bí mật nằm trong mã nguồn
> (`assets/js/membership.js` và `tools/gen-code.mjs` — **phải giống hệt nhau**).
> Người rành kỹ thuật có thể đọc được. Mã đủ để chặn người dùng thông thường
> sao chép đề, **không phải bảo vệ tuyệt đối**. Nếu cần chống copy mạnh, phải
> chuyển sang máy chủ thật (kiểm tra mã ở server).

### Đổi khoá bí mật

Sửa **cùng một chuỗi** ở 2 nơi rồi tạo lại toàn bộ mã:

- `assets/js/membership.js` → `const SECRET = "..."`
- `tools/gen-code.mjs` → `const SECRET = "..."`

Mã cũ sẽ mất hiệu lực ngay sau khi đổi.

---

## 7. Sổ từ vựng (Vocabulary notebook)

Sau khi bấm **Kiểm tra đáp án**, khối **Từ vựng** hiện danh sách từ của câu hỏi. Mỗi từ có nút **dấu trang**
ở góc phải để lưu; nút sáng lên khi từ đã có trong sổ, bấm lần nữa để bỏ lưu (không tạo bản trùng).

Vào **Sổ từ vựng** ở sidebar để xem các từ đã lưu:

| Thành phần | Mô tả |
|-----------|-------|
| Từ / Cách đọc / Nghĩa | Tiếng Nhật, furigana, nghĩa tiếng Việt |
| Câu tiếng Nhật | Câu gốc chứa từ, tự động xuống dòng (`wrap_text`) |
| Câu dịch | Bản dịch tiếng Việt của câu đó |
| Nguồn | ID câu hỏi gốc (ví dụ: `01`) để tra lại |
| 🔍 Tìm kiếm | Lọc theo từ, cách đọc, nghĩa; gõ tiếng Việt không dấu vẫn khớp. Nếu không khớp từ nào, app tìm tiếp trong câu Nhật/câu dịch |
| ⬇ Xuất CSV | Tải `so-tu-vung.csv` (UTF-8 BOM, cột: Từ, Cách đọc, Nghĩa, Câu tiếng Nhật, Câu dịch, Nguồn) |
| 🗑 Xoá hết | Bấm lần 1 để chuyển sang "Bấm lần nữa để xoá" (tự huỷ sau 4 giây), bấm lần 2 mới xoá toàn bộ |

Trong sổ, mỗi thẻ chỉ có nút **thùng rác** (xoá từ đó); nút lưu chỉ xuất hiện ở khối từ vựng sau khi chấm bài.

Sổ từ vựng nằm trong `pm3.state.v1` → mảng `vocab`, mỗi mục có dạng
`{ word, reading, meaning, source, jp, vn, savedAt }`. Số từ đã lưu hiện trên badge cạnh mục
**Sổ từ vựng**. Khi tắt bản dịch (`T`), phần **Câu dịch** trong sổ cũng được ẩn theo.

## 8. Phím tắt

| Phím | Tác dụng |
|------|----------|
| `1` `2` `3` `4` | Chọn đáp án ア / イ / ウ / エ |
| `Enter` | Kiểm tra đáp án, hoặc sang câu tiếp nếu đã trả lời |
| `←` / `→` | Câu trước / câu sau |
| `T` | Bật/tắt bản dịch tiếng Việt |
| `F` | Bật/tắt Furigana (phiên âm trên chữ Hán) |
| `Esc` | Đóng hộp thoại / menu |

## 9. Ghi chú kỹ thuật

- `localStorage` dùng 2 khoá: `pm3.state.v1` (tiến độ, bookmark, cài đặt, **sổ từ vựng** ở mảng
  `vocab`) và `pm3.questions.v1` (bộ đề đã nhập). Xoá 2 khoá này để về trạng thái ban đầu
  (sổ từ vựng cũng bị xoá theo).
- Không có thư viện ngoài; font Google Fonts là tuỳ chọn (mất mạng vẫn dùng font hệ thống).
- Mọi xử lý dữ liệu diễn ra trong trình duyệt, không có backend.

## 10. Việc có thể mở rộng tiếp

- Chế độ **thi thử** có đồng hồ đếm ngược và trộn câu/đáp án.
- Đồng bộ tiến độ lên tài khoản (cần backend).
- Export/Import tiến độ, thống kê theo thời gian, ôn tập ngắt quãng (spaced repetition).

---

## 11. Thư viện nhiều bộ đề + tài khoản + Google Drive

### Cấu trúc mới

```
codexcode/
├─ de/                            # TẤT CẢ bộ đề JSON đặt ở đây
│  ├─ JSON_R7_Zenki (1).json      # nguồn
│  ├─ json-r7-zenki-1.js          # bundle tự sinh (đừng sửa tay)
│  └─ JSON_R6_Zenki.json …
├─ data/library.js                # danh sách bộ đề (tự sinh)
├─ assets/js/
│  ├─ decks.js                    # nạp & phân quyền bộ đề
│  ├─ account.js                  # đăng ký / đăng nhập / đăng xuất (đồng bộ)
│  ├─ membership.js               # mã kích hoạt thành viên (khoá/mở đề)
│  ├─ cloud.js                    # Firebase Auth + Google Drive
│  └─ cloud-config.js             # ⚙ cấu hình cloud (mặc định TẮT)
└─ tools/build-de.mjs             # quét de/ → sinh bundle + library.js
```

### Thêm / sửa bộ đề

1. Chép file JSON vào thư mục `de/`.
2. Chạy:

```powershell
cd "C:\Users\Kero Luong\Downloads\codexcode"
node tools/build-de.mjs
```

Script sẽ kiểm tra cấu trúc từng file, sinh bundle `.js` (để chạy được cả
`file://`) và cập nhật `data/library.js`.

**Quy ước miễn phí:** tên file chứa `R7` → miễn phí. Các file khác → cần **mã kích hoạt thành viên** (mục 6).
Muốn đổi, sửa `FREE_MATCHERS` ở đầu `tools/build-de.mjs`.

### Tài khoản & đồng bộ

Tài khoản **không** dùng để mở khoá đề — việc đó do **mã kích hoạt** (mục 6).
Tài khoản chỉ để đồng bộ tiến độ học:

- **Chế độ cục bộ** (mặc định): không cần tài khoản, mọi thứ lưu trên máy.
- **Chế độ cloud**: đăng nhập bằng **Google** hoặc **Email/Mật khẩu** qua
  Firebase, dữ liệu học lưu trên **Google Drive** của từng người.

Xem hướng dẫn từng bước tại **[SETUP-CLOUD.md](SETUP-CLOUD.md)**.

### Dữ liệu học theo từng bộ đề

Tiến độ, câu đã lưu và phiên làm dở được lưu **riêng cho mỗi bộ đề**
(`pm3.deckstate.v1.<id>`). Sổ từ vựng và cài đặt hiển thị dùng chung
(`pm3.state.v1`). Tiến độ của phiên bản cũ (một bộ đề) được tự chuyển sang
bộ đề mặc định ở lần mở đầu tiên.