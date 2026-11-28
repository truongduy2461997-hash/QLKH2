# Báo cáo QLKH2 qua Telegram – bản thử nghiệm an toàn

**Trạng thái:** Chưa triển khai. Đây là mã backend để khôi phục **gửi báo cáo một chiều**,
không phải Telegram bot ghi trạng thái Đã TT lên QLKH. Không ảnh hưởng website đang chạy.

## Vì sao không thể chỉ sửa file index.html?

Repository hiện tại có mã **đọc trạng thái từ Realtime Database** và dòng chú thích
"Undo bên Telegram", nhưng không có mã `sendMessage`, webhook hoặc lịch gửi tin Telegram.
Do đó nguyên nhân dịch vụ cũ ngừng sau vài ngày **chưa thể xác định** từ repo này.
Đừng tái sử dụng code RTDB V1 để tìm và tự tick checkbox theo mã KH vì dễ chọn nhầm HĐ.

## Thiết kế

- Firebase Cloud Functions v2 (Node.js 22), Cloud Scheduler chạy lúc **07:15 mỗi ngày**
  theo múi giờ `Asia/Ho_Chi_Minh`.
- Nguồn là **Firestore `qlkhShared/{syncDocId}`** hiện đang được QLKH2 sử dụng,
  đọc hai trường `overdueTrackerJSON` và `paidJSON`. Không cần upload Excel mới
  hay đưa file gốc vào Telegram.
- Tổng hợp theo **nghĩa vụ gốc và lãi** lưu trong sổ; khi có bản ghi Excel QH cho
  cùng HĐ/loại nợ, không cộng trùng kỳ cũ. Loại trừ trạng thái `paid`.
- **Chỉ gửi số lượng và tổng tiền**, không gửi tên, mã KH, số hợp đồng, SĐT,
  số tài khoản, nội dung ghi chú hoặc file Excel.
- Cảnh báo nếu chưa có dữ liệu hoặc đã quá 72 giờ không đồng bộ; không gửi số 0 giả.
- Lưu dấu đã gửi theo ngày trên `qlkhTelegramDelivery` để ngăn gửi trùng.
- **Không có callback “Đã TT/Undo” qua Telegram**. Muốn thực hiện hành động đó,
  mở QLKH2 và thao tác sau khi đối chiếu thực tế.
- Độ chính xác phụ thuộc lịch/sổ trạng thái đã đồng bộ từ QLKH2; đây là báo cáo nhắc việc,
  **không thay thế số liệu Core Banking**.

## Yêu cầu trước khi kích hoạt

1. Được phép gửi **số liệu tổng hợp nội bộ** sang Telegram theo quy định bảo mật của đơn vị.
2. Có quyền Firebase project đang dùng, và gói cho phép Cloud Functions/Scheduler
   (thường cần kích hoạt thanh toán Blaze).
3. Có Telegram bot (có thể dùng bot cũ nếu token còn hiệu lực) và chat riêng nhận tin.
4. Mở Telegram, nhắn `/start` cho bot, bảo đảm bot không bị chặn.
5. Biết ID Firestore document gốc trong collection `qlkhShared` – document chứa
   `overdueTrackerJSON`, `paidJSON` và `dataset`. Không lấy ID của các chunk/manifest.

**Không gửi Bot Token, Chat ID hoặc Firebase credentials vào chat hay commit GitHub.**
Đặt riêng trong Google Cloud Secret Manager bằng các lệnh bên dưới.

## Cài đặt trên máy cá nhân (Windows PowerShell)

Từ thư mục repository đã clone:

```powershell
cd telegram-report
npm install
npm test
firebase login
firebase functions:secrets:set TELEGRAM_BOT_TOKEN --project qlkh-c3298
firebase functions:secrets:set TELEGRAM_CHAT_ID --project qlkh-c3298
firebase functions:secrets:set QLKH_SYNC_DOC_ID --project qlkh-c3298
```

Khi Firebase CLI hỏi, nhập trực tiếp từng giá trị bí mật; không đặt trong
mã nguồn. `QLKH_SYNC_DOC_ID` là ID của document có trạng thái QLKH hiện tại.

Nếu chưa biết Chat ID: nhắn `/start` cho bot rồi chạy lệnh PowerShell **trên máy cá nhân**:

```powershell
$botToken = Read-Host "Token bot Telegram"
$updates = Invoke-RestMethod -Uri ("https://api.telegram.org/bot" + $botToken + "/getUpdates")
$updates.result | ForEach-Object { $_.message.chat.id }
Remove-Variable botToken, updates
```

Lưu ý: nếu bot đã được gắn webhook, `getUpdates` sẽ không hoạt động cho đến khi
webhook được tháo. Không tự tháo webhook bot cũ khi chưa biết nó còn dùng ở đâu;
trường hợp đó lấy Chat ID từ cấu hình dịch vụ cũ hoặc tạo bot mới.

Triển khai **chỉ codebase `qlkhtelegram`**, không deploy Hosting hay Firestore Rules:

```powershell
firebase deploy --config firebase.json --only functions:qlkhtelegram --project qlkh-c3298
```

Sau triển khai, vào Cloud Scheduler của dự án và chọn job của
`qlkhTelegramDailyReport` → **Force run** để gửi bản thử nghiệm.
Kiểm tra tin nhắn và Firebase logs trước khi bật sử dụng chính thức.
Không cần để máy tính mở vì Cloud Scheduler chạy phía máy chủ.

## Xử lý khi không có tin

- Xem Cloud Scheduler: job có đang bật không và thời điểm chạy gần nhất.
- Xem Cloud Functions Logs: lỗi thiếu Secret, Firestore permission,
  Telegram HTTP 400/403, tài khoản đã chặn bot, hoặc dữ liệu đã quá cũ.
- Kiểm tra `qlkhTelegramDelivery`: `sent` là đã gửi,
  `failed` là cần kiểm tra; không được tự xóa lịch sử để gửi lại nhiều lần.
- Bot Token có thể bị thu hồi; hãy tạo token mới trong BotFather và cập nhật Secret Manager.
- Mỗi ngày chỉ gửi một lần; lịch gửi không phụ thuộc trình duyệt hoặc GitHub Pages.

## Giới hạn cần biết

Backend mới không liên quan đến dịch vụ Telegram cũ; chưa có Bot Token/Chat ID/nhật ký
dịch vụ cũ nên **chưa khôi phục được kênh cũ và chưa gửi tin thật**.
Bản thử nghiệm cần được kiểm tra song song với Tab 3 trên 2–3 kỳ dữ liệu trước
khi tin tưởng số liệu. Chỉ bật sau khi được phép truyền báo cáo nội bộ qua Telegram.

Tham khảo tài liệu chính thức:
- https://core.telegram.org/bots/api
- https://firebase.google.com/docs/functions/schedule-functions
- https://firebase.google.com/docs/functions/config-env
