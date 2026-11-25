# Telegram QLKH2 trên Firebase Spark (không cần Blaze)

## Trạng thái

Đây là **phương án ưu tiên** khi Firebase của Chồng đang dùng Spark.
Dùng **Google Apps Script chạy trong tài khoản Google riêng tư**, đọc Firestore bằng
OAuth của tài khoản có quyền truy cập dự án và gửi báo cáo tổng hợp tới Telegram.

- Không deploy Cloud Functions, không bật billing.
- Không chạy từ trình duyệt QLKH2: máy tính có thể tắt.
- Không copy hoặc thay đổi Excel gốc, dữ liệu Firebase, trạng thái Đã TT.
- Không đẩy Telegram token, Chat ID, hoặc khóa Firebase lên GitHub công khai.
- Giờ chạy mục tiêu: khoảng **07:15 giờ Việt Nam**; Apps Script trigger
  `nearMinute(15)` có sai số khoảng 15 phút, không phải đúng từng phút.
- Tin chỉ chứa **thống kê tổng hợp** nghĩa vụ chưa xử lý từ sổ Firestore, không
  chứa danh tính, mã KH, hợp đồng, SĐT.
- Để gửi thống kê từ QLKH lên Telegram phải được đơn vị cho phép theo quy định
  bảo mật nội bộ. Nếu không được phép, không kích hoạt.

## Chuẩn bị

1. Dùng Google account đang có quyền **Firestore IAM** trong Firebase project
   `qlkh-c3298`. Firebase Authentication đăng nhập website không nhất thiết
   đồng nghĩa tài khoản Google có quyền IAM để đọc REST API.
2. Trong @BotFather, thu hồi token đã bị gửi vào chat và tạo **token mới**.
   Không gửi token mới qua chat, email, GitHub hoặc ảnh chụp.
3. Vào `https://t.me/QLKHSTB_bot`, gửi `/start`.
4. Cần biết private Chat ID nhận tin (chỉ số dương) và Firestore document ID
   trong `qlkhShared` chứa `overdueTrackerJSON`, `paidJSON`.
   Không chọn document dạng chunk hoặc manifest.
5. Có quyền tạo một **Google Apps Script riêng tư** ở `https://script.google.com/home/projects/create`.

## Cách cài đặt

1. Mở Google Apps Script và tạo một dự án mới, đặt tên `QLKH Telegram Spark`.
2. Sao chép toàn bộ nội dung [Code.gs](./Code.gs) vào file `Code.gs`.
3. Trong **Project Settings**, bật "Show appsscript.json manifest file in editor",
   mở file `appsscript.json`, thay bằng nội dung [manifest](./appsscript.json).
4. Vào **Project Settings → Script Properties**, thêm `TELEGRAM_BOT_TOKEN`
   bằng token mới sau khi đã Revoke. Bấm Save. Sau khi nhắn `/start` với bot,
   chọn hàm `findTelegramChatId` → Run; xem Chat ID riêng trong **Execution log**.
   Nếu bot đang gắn webhook cũ, hàm có thể báo HTTP 409; không tự xóa webhook.
5. Quay lại **Script Properties**, thêm:
   - `TELEGRAM_CHAT_ID`: Chat ID vừa tìm thấy;
   - `QLKH_SYNC_DOC_ID`: ID document Firestore ở `qlkhShared`.
   **Không** chia sẻ dự án Apps Script cho người khác; người có quyền chỉnh
   sửa code có thể lấy secrets từ Script Properties.
6. Bấm Save. Chọn hàm `sendQlkhTest` → Run → cấp quyền OAuth.
   Bot cần nhắn thử thành công trước khi dùng báo cáo thực tế.
7. Chọn hàm `previewQlkhTotals` → Run. Mở **Execution log** để xem chỉ
   số lượng tổng hợp. Nếu báo HTTP 403, kiểm tra đúng tài khoản Google,
   quyền IAM dự án và `datastore` OAuth scope. Không mở Firestore Rules public.
8. Khi các tổng hợp khớp QLKH2 và được phép gửi nội bộ, chọn
   `setupQlkhDailyTrigger` → Run **một lần** để tạo lịch hằng ngày.
9. Mở tab **Triggers** xác nhận handler `sendQlkhDaily`, kiểm tra **Executions**
   sau ngày chạy đầu tiên. Có thể chạy `sendQlkhDaily` thủ công để gửi báo cáo
   trong ngày, nhưng hàm sẽ không gửi lại nếu đã thành công hôm đó.

## Lấy Chat ID mà không công khai token

Cách an toàn nhất là sử dụng tính năng của Telegram hoặc công cụ cục bộ do Chồng
kiểm soát để xem `getUpdates` của bot; chỉ thao tác trên máy cá nhân và không
dán token vào website bên thứ ba. Nếu bot đang có webhook của dịch vụ cũ,
`getUpdates` có thể không hoạt động – không tự xóa webhook khi chưa kiểm tra
phụ thuộc cũ.

## Lưu ý về dữ liệu và chi phí

- Gói Firebase Spark vẫn được giữ nguyên. Apps Script có hạn mức Google, và
  có thể gặp lỗi/gián đoạn trong những ngày dịch vụ có sự cố.
- Bot chỉ đọc dữ liệu **đã đồng bộ lên Firestore** (không đọc Excel nằm trên máy).
  Nếu dữ liệu không được cập nhật hơn 72 giờ, gửi **cảnh báo dữ liệu cũ** chứ
  không gửi số tiền có thể sai.
- Đây là báo cáo theo nghĩa vụ từ sổ quá hạn/đến hạn, không thay thế báo cáo
  Core Banking; so khớp ít nhất 2–3 ngày trước khi dựa vào để xử lý công việc.
- OAuth `ScriptApp.getOAuthToken()` sử dụng quyền tài khoản Google chạy trigger
  và yêu cầu tài khoản đó có IAM quyền đọc Firestore. Không cần tạo JSON key
  của service account hoặc lưu mật khẩu Google trong script.
- Giữ bí mật quyền chỉnh sửa Apps Script. Nếu nghi lộ token, **Revoke** ngay
  trong @BotFather rồi cập nhật lại Script Properties.
- Chỉ Script Properties `QLKH_LAST_SENT_DAY` được ghi sau khi gửi thành công
  để hạn chế tin trùng. Xóa khóa này chỉ khi thực sự muốn gửi lại trong ngày.

## Khắc phục lỗi

| Lỗi | Cách xử lý |
|---|---|
| Telegram HTTP 400/403 | Kiểm tra token, Chat ID, bot đã `/start` và không bị chặn |
| Firestore HTTP 401/403 | Tài khoản Google đang chạy script không có quyền IAM hoặc scope chưa cấp |
| Chưa có sổ nghĩa vụ | Tải Excel trên QLKH2, lưu/đồng bộ lên Firestore, xem `QLKH_SYNC_DOC_ID` |
| Không có tin đúng 07:15 | Kiểm tra Triggers, Executions; trigger có thể lệch ±15 phút |
| Cảnh báo dữ liệu quá cũ | Mở QLKH2, đồng bộ Firebase; không kết luận số tiền từ dữ liệu cũ |

### Tài liệu Google

- https://developers.google.com/apps-script/guides/triggers/installable
- https://developers.google.com/apps-script/reference/script/script-app#getoauthtoken
- https://firebase.google.com/docs/firestore/use-rest-api
