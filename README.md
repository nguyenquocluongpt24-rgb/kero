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
`data/questions.json` nếu file này tồn tại. (Khi mở bằng `file://`, trình duyệt chặn `fetch`,
nên trong trường hợp đó hãy dùng nút **Nhập JSON**.)

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
- **Giao diện sáng/tối**, nút **Bản dịch ON/OFF** để ẩn/hiện tiếng Việt và nút **Furigana** để ẩn/hiện
  phiên âm cách đọc trên chữ Hán (luyện đọc đề tiếng Nhật), responsive tới mobile.

## 6. Phím tắt

| Phím | Tác dụng |
|------|----------|
| `1` `2` `3` `4` | Chọn đáp án ア / イ / ウ / エ |
| `Enter` | Kiểm tra đáp án, hoặc sang câu tiếp nếu đã trả lời |
| `←` / `→` | Câu trước / câu sau |
| `T` | Bật/tắt bản dịch tiếng Việt |
| `F` | Bật/tắt Furigana (phiên âm trên chữ Hán) |
| `Esc` | Đóng hộp thoại / menu |

## 7. Ghi chú kỹ thuật

- `localStorage` dùng 2 khoá: `pm3.state.v1` (tiến độ, bookmark, cài đặt) và `pm3.questions.v1`
  (bộ đề đã nhập). Xoá 2 khoá này để về trạng thái ban đầu.
- Không có thư viện ngoài; font Google Fonts là tuỳ chọn (mất mạng vẫn dùng font hệ thống).
- Mọi xử lý dữ liệu diễn ra trong trình duyệt, không có backend.

## 8. Việc có thể mở rộng tiếp

- Chế độ **thi thử** có đồng hồ đếm ngược và trộn câu/đáp án.
- Đồng bộ tiến độ lên tài khoản (cần backend).
- Export/Import tiến độ, thống kê theo thời gian, ôn tập ngắt quãng (spaced repetition).
