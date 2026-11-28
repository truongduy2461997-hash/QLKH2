# Tái cấu trúc QLKH2 có kiểm soát

## Phạm vi và nguyên tắc

Dùng **HTML/CSS/JavaScript thuần**, tiếp tục đọc trực tiếp **Excel tổng hợp gốc**.
Giữ giao diện, cấu trúc nghiệp vụ đang dùng và dữ liệu lưu trên Firestore/IndexedDB/localStorage.
Không xóa hay ghi lại trạng thái khách hàng trên cloud trong quá trình refactor.
Mỗi giai đoạn triển khai trên branch/PR riêng, có kiểm tra trước khi merge.

- Baseline mã nguồn: `c72132228345a0cafd448fcd1b163e5e3a6fd826`.
- Branch sao lưu mã nguồn: `backup/qlkh2-before-refactor-20261125`.
- Branch thực hiện giai đoạn 1: `refactor/stage1-safety-tests-20261125`.
- **Branch GitHub không phải bản sao dữ liệu Firebase đang chạy**. Cần xuất bản sao cloud và thử khôi phục riêng trước khi migration trạng thái.

## Giai đoạn 1 – Cô lập đồng bộ rủi ro, thêm kiểm thử

**Các thay đổi được chia thành hai PR để tránh ảnh hưởng vận hành:**

- PR cô lập (chưa triển khai lên main): tạm tắt cơ chế **RTDB V1 trong `index.html`** vốn dò tất cả checkbox từ text/mã KH và tự gọi `.click()`, đồng thời có thể PATCH trạng thái vào RTDB.
- **Giữ nguyên** mô-đun Firestore/Auth nằm trong `src/qlkh.html`, hệ thống Excel, IndexedDB và Sổ Đã xử lý.
- Thêm kiểm tra bản build QLKH dựa trên dữ liệu gzip thật, thay vì chỉ so kích thước hoặc bản JS.
- Thêm bài test với khách hàng giả lập: đến hạn, Đã TT, khôi phục, chuyển kỳ và ngày quá hạn.
- Thêm GitHub Actions chạy kiểm tra trên PR trước khi merge.
- Module Chi tiêu chưa khớp với `src/chitieu.html`; CI chỉ cảnh báo, **không tự build và không ghi đè bản đang chạy**.

**Ảnh hưởng phải kiểm tra kỹ trước khi merge:** chức năng Telegram/RTDB V1 liên quan các checkbox sẽ ngừng đồng bộ trong nhánh thử nghiệm. Cần xác định còn sử dụng luồng này không và xây adapter theo khóa nghĩa vụ nếu cần giữ.

## Giai đoạn 2 – Một sổ nghĩa vụ duy nhất

Mô hình khóa nghiệp vụ đề xuất:
`Mã KH | Số hợp đồng | Gốc/Lãi/Lãi phạt | Ngày đến hạn gốc`.

- Không dùng tên khách hàng hoặc text hiển thị làm khóa.
- Không tự xóa nghĩa vụ vì file LN80 chuyển lịch sang tháng sau.
- Trạng thái `unpaid`, `paid`, `restored` và dấu thời gian/người thao tác.
- Khi Đã TT: chỉ ẩn nghĩa vụ tương ứng, giữ bản ghi lịch sử trong Đã xử lý.
- Tránh cộng gốc/lãi cũ lần nữa khi LN80 xuất số dư quá hạn.
- Giữ được override số ngày trễ lần đầu và tự cộng ngày theo lịch.
- Migration từ `PAID_KEY` và `OVERDUE_KEY` cũ phải là **chuyển đổi có version + backup + dry-run + rollback**.
- Không thực hiện migration tự động trong giai đoạn 1.

## Giai đoạn 3 – Bộ đọc Excel và build

- Giữ nguyên file Excel xuất từ hệ thống.
- Kiểm tra header bắt buộc và tên sheet; xuất thống kê trước/sau import.
- Báo: hợp đồng thiếu mã, trùng khóa, ngày sai, tiền âm, mất nghĩa vụ chưa Đã TT.
- Chỉ xác nhận import khi qua bước kiểm tra. Không tự sửa số liệu nguồn.
- Chuẩn hóa build của QLKH và Chi tiêu; tìm nguồn chính xác cho Lãi suất/LTV trước khi đụng.
- CI bắt buộc kiểm tra mô-đun nén, JS syntax, nghiệp vụ và version cache.

## Giai đoạn 4 – Hiệu năng và responsive

- Tách `src/qlkh.html` theo dữ liệu/nghiệp vụ/hiển thị mà không đổi API của tab.
- Rà soát hàm khai báo trùng ở cấp cao nhất: `applyToday`, `renderToday`, `exportToday`, các hàm chi tiết hợp đồng.
- Lập chỉ mục theo mã KH và HĐ, loại các vòng lặp DOM không cần thiết.
- Responsive thật cho iPhone Safari thay vì thu phóng toàn bộ iframe.

## Checklist nghiệm thu trước khi đưa vào main

1. Mọi nghĩa vụ của khách có nhiều HĐ vẫn độc lập khi tích Đã TT.
2. HĐ chưa TT vẫn được giữ khi Excel kỳ tiếp theo đã thay ngày đến hạn.
3. Có gốc QH + lãi QH nhưng không bị cộng trùng với kỳ cũ.
4. Nhập ngày trễ thủ công, reload/cập nhật Excel/đổi thiết bị vẫn giữ đúng ngày.
5. Khôi phục từ Đã xử lý không ảnh hưởng khoản đã thu khác.
6. Thử hai máy đồng bộ ngược chiều và xung đột, không đảo trạng thái.
7. Tab Chi tiêu, Telegram/Radar, LTV, lãi suất vẫn hoạt động theo yêu cầu.
8. Firebase Auth/Firestore Rules và RTDB Rules được rà soát; bảo đảm không cho phép đọc/ghi trái phép.
9. Có snapshot dữ liệu Firebase thực tế đã thử phục hồi.

## Quy trình phát hành và rollback

- Merge khi CI đạt + kiểm thử trên bản chạy thử với dữ liệu giả lập + có backup dữ liệu.
- Trước merge: ghi SHA `main` hiện tại và chốt các bảng thống kê.
- Sau merge: kiểm tra dữ liệu mới, Firebase và trên iPhone Safari.
- Nếu có sai khác: revert commit triển khai về baseline/commit trước; giữ nguyên dữ liệu cloud, không tự xóa.
- Không dùng Git revert để thay thế quá trình phục hồi dữ liệu đã bị ghi sai trong Firebase.

## Bảo mật

Repository công khai có cấu hình Firebase và mã đồng bộ mặc định trong frontend.
Firebase API key phía client không tự nó cấp quyền; **quyền thật do Firebase Auth + Security Rules quyết định**.
Cần kiểm tra RTDB/Firestore Rules hiện tại, thu hồi quyền public nếu có, cân nhắc thay mã đồng bộ và bảo vệ thông tin khách hàng trước khi triển khai.
