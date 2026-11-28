/**
 * QLKH2 -> Telegram, Firebase Spark compatible (Google Apps Script).
 * Run from a PRIVATE Apps Script owned by a user with Firestore IAM access.
 *
 * Requires Script Properties:
 *   TELEGRAM_BOT_TOKEN  - token revoked/rotated after prior disclosure
 *   TELEGRAM_CHAT_ID    - private Telegram chat ID
 *   QLKH_SYNC_DOC_ID    - Firestore qlkhShared document ID (no file upload)
 *
 * No keys/passwords or customer identifiers must be committed to GitHub.
 * This code is read-only on Firestore; only sends summary counts and amounts.
 */
const QLKH_PROJECT_ID = 'qlkh-c3298';
const QLKH_TZ = 'Asia/Ho_Chi_Minh';
const QLKH_PREVIEW_DAYS = 7;
const QLKH_STALE_HOURS = 72;

function qlkhProps_() {
  const p = PropertiesService.getScriptProperties();
  const token = p.getProperty('TELEGRAM_BOT_TOKEN');
  const chatId = p.getProperty('TELEGRAM_CHAT_ID');
  const docId = p.getProperty('QLKH_SYNC_DOC_ID');
  if (!token || !/^\d+:[A-Za-z0-9_-]+$/.test(token)) throw new Error('Thiếu token Telegram hợp lệ trong Script Properties');
  if (!chatId || !/^\d+$/.test(chatId)) throw new Error('Thiếu Telegram private Chat ID (chỉ số dương)');
  if (!docId || !/^[A-Za-z0-9_-]{3,200}$/.test(docId)) throw new Error('Thiếu ID tài liệu qlkhShared (QLKH_SYNC_DOC_ID)');
  return {token, chatId, docId, properties:p};
}
function qlkhReadRoot_(docId) {
  const path = 'projects/' + QLKH_PROJECT_ID + '/databases/(default)/documents/qlkhShared/' + encodeURIComponent(docId);
  const mask = ['overdueTrackerJSON','overdueTracker','paidJSON','paid','updatedAt'];
  const url = 'https://firestore.googleapis.com/v1/' + path +
    '?' + mask.map(s=>'mask.fieldPaths='+encodeURIComponent(s)).join('&');
  const resp = UrlFetchApp.fetch(url,{
    method:'get',
    headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},
    muteHttpExceptions:true
  });
  if (resp.getResponseCode() !== 200) {
    // Never dump payload (may contain customer data). OAuth/IAM not Firebase Rules.
    throw new Error('Không đọc được Firestore; HTTP '+resp.getResponseCode()+'. Kiểm tra tài khoản Google có quyền dự án và scope datastore.');
  }
  const raw = JSON.parse(resp.getContentText());
  return raw.fields || {};
}
function qlkhField_(fields,key) {
  const v = fields[key] || {};
  return v.stringValue !== undefined ? v.stringValue :
         v.integerValue !== undefined ? v.integerValue :
         v.timestampValue !== undefined ? v.timestampValue : null;
}
function qlkhObject_(raw) {
  if (!raw) return {};
  if (typeof raw === 'string') {
    const result = JSON.parse(raw);
    if (result && typeof result==='object' && !Array.isArray(result)) return result;
    throw new Error('Trạng thái QLKH không phải đối tượng');
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  return {};
}
function qlkhOrdinal_(raw) {
  const key = String(raw||'').slice(0,10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const ms = Date.parse(key+'T00:00:00Z');
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0,10)===key
    ? Math.floor(ms/86400000):null;
}
function qlkhPaid_(paid,key) {
  const e = paid&&paid.loan&&paid.loan[key];
  return !!e && e!==false && e.status!=='restored' && e.active!==false && e.restored!==true;
}
function qlkhGroup_(r) {
  return [String(r.maKH||'').trim(),String(r.contract||'').trim(),r.kind==='interest'?'interest':'principal'].join('|');
}
function qlkhSummary_(tracker,paid,dateKey) {
  const now=qlkhOrdinal_(dateKey);
  if(now===null) throw new Error('Ngày báo cáo không hợp lệ');
  const rows=Object.values(tracker||{}).filter(e=>e&&e.key&&e.status==='open'&&!qlkhPaid_(paid,e.key)&&Number(e.amount||0)>0);
  const reported=new Set(rows.filter(e=>e.source!=='scheduled_due').map(qlkhGroup_));
  const out={soonCount:0,soonAmount:0,lateCount:0,lateAmount:0,unknownCount:0};
  const seen=new Set();
  for(const e of rows) {
    if(seen.has(e.key))continue;
    seen.add(e.key);
    const amount=Math.round(Number(e.amount||0));
    if(!Number.isFinite(amount)||amount<=0)continue;
    if(e.source!=='scheduled_due'){
      out.lateCount++;out.lateAmount+=amount;continue;
    }
    const due=qlkhOrdinal_(e.firstDueDate);
    if(due===null){out.unknownCount++;continue;}
    if(due<now && reported.has(qlkhGroup_(e)))continue;
    if(due<now){out.lateCount++;out.lateAmount+=amount;}
    else if(due<=now+QLKH_PREVIEW_DAYS){out.soonCount++;out.soonAmount+=amount;}
  }
  return out;
}
function qlkhReadSummary_() {
  const {docId}=qlkhProps_();
  const today=Utilities.formatDate(new Date(),QLKH_TZ,'yyyy-MM-dd');
  const fields=qlkhReadRoot_(docId),tracker=qlkhObject_(qlkhField_(fields,'overdueTrackerJSON')||qlkhField_(fields,'overdueTracker'));
  const paid=qlkhObject_(qlkhField_(fields,'paidJSON')||qlkhField_(fields,'paid'));
  const updatedAt=qlkhField_(fields,'updatedAt');
  if(!Object.keys(tracker).length)throw new Error('Sổ nghĩa vụ chưa có dữ liệu; không gửi số 0 giả');
  const updatedMs=Date.parse(updatedAt||'');
  const tooOld=!Number.isFinite(updatedMs)||(Date.now()-updatedMs)>QLKH_STALE_HOURS*3600000;
  const summary=tooOld?null:qlkhSummary_(tracker,paid,today);
  return {date:today,updatedAt,summary,tooOld};
}
function qlkhFormat_(r) {
  const date=r.date.split('-').reverse().join('/');
  if(r.tooOld) {
    return '⚠ QLKH '+date+': dữ liệu Firebase đã quá 72 giờ không cập nhật. Không gửi số liệu cũ. Hãy mở QLKH2 và kiểm tra đồng bộ.';
  }
  const money=n=>Math.round(n).toLocaleString('vi-VN')+' đ';
  const x=r.summary;
  return [
    '📊 QLKH – BÁO CÁO '+date,
    '⏳ Đến hạn trong '+QLKH_PREVIEW_DAYS+' ngày: '+x.soonCount+' nghĩa vụ · '+money(x.soonAmount),
    '🔴 Quá hạn chưa xử lý: '+x.lateCount+' nghĩa vụ · '+money(x.lateAmount),
    ...(x.unknownCount?['⚠ Chưa rõ ngày: '+x.unknownCount+' nghĩa vụ']:[]),
    '☁ Đồng bộ: '+Utilities.formatDate(new Date(r.updatedAt),QLKH_TZ,'dd/MM/yyyy HH:mm'),
    'Chỉ tổng hợp sổ nghĩa vụ QLKH2; đối chiếu Core Banking trước khi thu.'
  ].join('\n');
}
function qlkhSendMessage_(token,chatId,message) {
  const resp=UrlFetchApp.fetch('https://api.telegram.org/bot'+token+'/sendMessage',{
    method:'post',
    contentType:'application/json',
    payload:JSON.stringify({chat_id:chatId,text:message,disable_web_page_preview:true}),
    muteHttpExceptions:true
  });
  if(resp.getResponseCode()!==200)throw new Error('Gửi Telegram thất bại; HTTP '+resp.getResponseCode()+'. Kiểm tra đã /start và Chat ID.');
  const reply=JSON.parse(resp.getContentText());
  if(!reply.ok)throw new Error('Telegram báo gửi thất bại');
}
function sendQlkhDaily() {
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(5000)) return;
  try {
    const cfg=qlkhProps_();
    const day=Utilities.formatDate(new Date(),QLKH_TZ,'yyyy-MM-dd');
    if(cfg.properties.getProperty('QLKH_LAST_SENT_DAY')===day)return;
    const message=qlkhFormat_(qlkhReadSummary_());
    qlkhSendMessage_(cfg.token,cfg.chatId,message);
    // No message or raw customer data is saved to Script Properties.
    cfg.properties.setProperty('QLKH_LAST_SENT_DAY',day);
  } finally {lock.releaseLock();}
}
/**
 * One-time setup helper: sends no data and does not expose token in logs.
 * Start a private conversation with the bot first. Existing webhook may
 * prevent getUpdates; do not remove legacy webhook automatically.
 */
function findTelegramChatId() {
  const token=PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN');
  if(!token||!/^\d+:[A-Za-z0-9_-]+$/.test(token))throw new Error('Hãy thêm TELEGRAM_BOT_TOKEN vào Script Properties trước');
  const resp=UrlFetchApp.fetch('https://api.telegram.org/bot'+token+'/getUpdates',{
    method:'get',muteHttpExceptions:true
  });
  if(resp.getResponseCode()!==200)
    throw new Error('Không lấy được Chat ID (HTTP '+resp.getResponseCode()+'). Bot có thể đang gắn webhook của dịch vụ cũ; không tự xóa webhook.');
  const updates=JSON.parse(resp.getContentText());
  const chats=(updates.result||[]).map(u=>u.message&&u.message.chat).filter(c=>c&&c.type==='private'&&Number(c.id)>0);
  if(!chats.length)throw new Error('Chưa thấy cuộc trò chuyện riêng. Hãy /start cho bot và gửi thêm 1 tin nhắn, sau đó chạy lại.');
  const id=String(chats[chats.length-1].id);
  Logger.log('Private Chat ID gần nhất: '+id+' (chỉ lưu vào Script Properties, không gửi công khai)');
  return id;
}

function sendQlkhTest() {
  const cfg=qlkhProps_();
  qlkhSendMessage_(cfg.token,cfg.chatId,'✅ @QLKHSTB_bot đã kết nối Google Apps Script. Đây là tin kiểm tra, chưa có dữ liệu khách hàng.');
}
function previewQlkhTotals() {
  const r=qlkhReadSummary_();
  if(r.tooOld)throw new Error('Dữ liệu nguồn đã quá 72h; cần đồng bộ QLKH2');
  // Preview only aggregate counts, never raw Firestore or credentials.
  Logger.log('Sắp đến hạn: %s nghĩa vụ; Quá hạn: %s nghĩa vụ',r.summary.soonCount,r.summary.lateCount);
}
function setupQlkhDailyTrigger() {
  // Keep this Apps Script private. Only remove the triggers owned by this script/function.
  ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='sendQlkhDaily')
    .forEach(t=>ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sendQlkhDaily').timeBased()
    .atHour(7).nearMinute(15).everyDays(1).inTimezone(QLKH_TZ).create();
}
