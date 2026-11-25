'use strict';

// Scheduled Firebase Cloud Function. Credentials are managed in Secret Manager,
// never in GitHub or browser JavaScript. Deploy separately from GitHub Pages.
const {initializeApp} = require('firebase-admin/app');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const {onSchedule} = require('firebase-functions/v2/scheduler');
const {defineSecret} = require('firebase-functions/params');
const crypto = require('node:crypto');
const {buildSummary, formatReport} = require('./report.cjs');

initializeApp();

const TELEGRAM_BOT_TOKEN = defineSecret('TELEGRAM_BOT_TOKEN');
const TELEGRAM_CHAT_ID = defineSecret('TELEGRAM_CHAT_ID');
const QLKH_SYNC_DOC_ID = defineSecret('QLKH_SYNC_DOC_ID');
const DAY_MS = 86400000;

function localDateKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric'
  }).formatToParts(now);
  const val = k => parts.find(p => p.type === k)?.value;
  return [val('year'), val('month'), val('day')].join('-');
}

async function telegramSend(token, chatId, message) {
  const response = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({chat_id: chatId, text: message, disable_web_page_preview:true}),
    signal: AbortSignal.timeout(15000)
  });
  // Don't include API response text in logs: can contain chat or private metadata.
  if (!response.ok) throw new Error('Telegram HTTP ' + response.status);
  const data = await response.json();
  if (!data.ok) throw new Error('Telegram API returned ok=false');
  return true;
}

async function claimDelivery(db, ref) {
  const now = Date.now();
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref), item = snap.exists ? snap.data() : {};
    if (item.status === 'sent') return false;
    if (item.status === 'sending' && Number(item.leaseUntil || 0) > now) return false;
    tx.set(ref, {
      status:'sending', startedAtMs: now, leaseUntil: now + 15 * 60 * 1000,
      attempt: (Number(item.attempt)||0) + 1
    }, {merge:true});
    return true;
  });
}

async function buildText(db, docId, day) {
  const snap = await db.collection('qlkhShared').doc(docId).get();
  if (!snap.exists) return '⚠ QLKH: Chưa tìm thấy dữ liệu đồng bộ. Hãy mở website QLKH để kiểm tra kết nối.';
  const d = snap.data(), updatedAt = d.updatedAt || null;
  const lastUpdated = Date.parse(updatedAt || '');
  const age = Date.now() - lastUpdated;
  if (!Number.isFinite(age) || age > 72*60*60*1000) {
    return '⚠ QLKH: Dữ liệu đã quá 72 giờ chưa đồng bộ. Không gửi số liệu cũ. Hãy mở QLKH và kiểm tra Firebase.';
  }
  if (!d.overdueTrackerJSON && !d.overdueTracker) {
    return '⚠ QLKH: Chưa có Sổ nghĩa vụ trên Firebase. Không thể lập báo cáo; hãy đồng bộ lại QLKH.';
  }
  const parseObject = (raw) => {
    if (typeof raw === 'string') {
      const x = JSON.parse(raw);
      if (!x || typeof x !== 'object' || Array.isArray(x)) throw new Error('Unexpected data format');
      return x;
    }
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  };
  const ledger = parseObject(d.overdueTrackerJSON || d.overdueTracker);
  if (!Object.keys(ledger).length) {
    return '⚠ QLKH: Sổ nghĩa vụ chưa có dữ liệu, không gửi số liệu 0 gây hiểu nhầm. Hãy đồng bộ lại Excel.';
  }
  const paid = parseObject(d.paidJSON || d.paid);
  const result = buildSummary({overdueTracker:ledger,paid,businessDate:day,lookAhead:7});
  return formatReport(result, {sourceUpdatedAt:updatedAt});
}

exports.qlkhTelegramDailyReport = onSchedule({
  schedule:'15 7 * * *',
  timeZone:'Asia/Ho_Chi_Minh',
  region:'asia-southeast1',
  retryCount:0, // Explicit idempotency record; failures show in logs.
  memory:'256MiB',
  secrets:[TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, QLKH_SYNC_DOC_ID]
}, async () => {
  const token = TELEGRAM_BOT_TOKEN.value();
  const chat = TELEGRAM_CHAT_ID.value();
  const docId = QLKH_SYNC_DOC_ID.value();
  if (!token || !chat || !docId || !/^\d+:[A-Za-z0-9_-]+$/.test(token) || !/^[A-Za-z0-9_-]{3,200}$/.test(docId)) {
    throw new Error('Telegram or Firestore configuration is missing/invalid');
  }
  const day = localDateKey(), db = getFirestore();
  const id = crypto.createHash('sha256').update(docId).digest('hex').slice(0,12);
  const ref = db.collection('qlkhTelegramDelivery').doc(day + '_' + id);
  if (!await claimDelivery(db,ref)) return;
  try {
    const message = await buildText(db,docId,day);
    await telegramSend(token,chat,message);
    await ref.set({status:'sent', deliveredAt:FieldValue.serverTimestamp()}, {merge:true});
  } catch (err) {
    await ref.set({status:'failed', leaseUntil:0, failedAt:FieldValue.serverTimestamp(),
      lastError:String(err && err.message || 'unknown').slice(0,120)}, {merge:true});
    // Never log token, chat_id, or customer records.
    throw new Error('Telegram scheduled delivery failed: ' + String(err && err.message || 'unknown').slice(0,100));
  }
});
