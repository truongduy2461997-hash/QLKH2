# BỘ CÔNG CỤ QLKH - CẤU TRÚC MODULAR

## Cấu trúc thư mục

```text
qlkh_dashboard_modular/
├── index.html
└── modules/
    ├── qlkh.data.js
    ├── chitieu.data.js
    ├── rate.data.js
    └── ltv.data.js
```

## Cách sử dụng

1. Giữ nguyên `index.html` và thư mục `modules/` cùng cấp.
2. Mở bằng web server hoặc triển khai toàn bộ thư mục lên GitHub Pages/Firebase Hosting.
3. Không đổi tên các biến global:
   - `window.QLKH_CHUNKS`
   - `window.CHITIEU_CHUNKS`
   - `window.RATE_CHUNKS`
   - `window.LTV_CHUNKS`
4. Khi cập nhật một module, chỉ thay mảng Base64 trong file `.data.js` tương ứng.
5. Không mở riêng `index.html` rồi bỏ quên thư mục `modules/`, vì trang sẽ báo thiếu dữ liệu module.

## Mẫu file data

```javascript
window.QLKH_CHUNKS = [
  "H4sIAAAAA...",
  "...phần Base64 tiếp theo..."
];
```

Mỗi phần tử mảng là một đoạn của cùng một chuỗi Base64 gzip. Thứ tự phần tử phải được giữ nguyên.
