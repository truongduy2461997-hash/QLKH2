'use strict';

/**
 * QLKH2 daily aggregate from the EXISTING Firestore overdueTrackerJSON/paidJSON.
 * - Does not use customer names, phone numbers, IDs, or loan contracts in output.
 * - Never infers payment from a changed date on the imported Excel file.
 * - Deliberately counts "nghĩa vụ" (principal and interest independently).
 * - No dependence on Telegram, Firebase SDK, Node packages or browser DOM.
 */

function ordinal(v) {
  if (!v) return null;
  const x = String(v).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(x)) return null;
  const n = Date.parse(x + 'T00:00:00.000Z');
  return Number.isFinite(n) && new Date(n).toISOString().slice(0,10) === x
    ? Math.floor(n / 86400000) : null;
}

function activePaidEntry(x) {
  return x != null && x !== false &&
    !(x && (x.status === 'restored' || x.active === false || x.restored === true));
}

function effectiveStatus(entry, paid) {
  if (!entry || entry.status !== 'open') return false;
  return !(paid && paid.loan && activePaidEntry(paid.loan[entry.key]));
}

function groupId(e) {
  // Internal dedup only. These identifiers never leave this process.
  const c = String(e.contract || '').trim(), id = String(e.maKH || '').trim();
  return [id, c, e.kind === 'interest' ? 'interest' : 'principal'].join('|');
}

function buildSummary({ overdueTracker, paid, businessDate, lookAhead = 7 } = {}) {
  const now = ordinal(businessDate);
  if (now == null) throw new Error('Invalid businessDate');
  const horizon = now + lookAhead;
  if (!Number.isInteger(lookAhead) || lookAhead < 1 || lookAhead > 30) throw new Error('Invalid lookAhead');
  const entries = Object.values(overdueTracker || {}).filter(x =>
    x && typeof x === 'object' && typeof x.key === 'string' &&
    effectiveStatus(x, paid) && Number(x.amount || 0) > 0
  );

  // QLKH frontend suppresses scheduled overdue entries when a source-reported
  // overdue entry already represents the same contract/kind. Avoid double count.
  const reported = new Set(entries.filter(e => e.source !== 'scheduled_due').map(groupId));
  const pending = { count: 0, amount: 0 };
  const late = { count: 0, amount: 0 };
  const unknown = { count: 0, amount: 0 };
  const seen = new Set();
  for (const e of entries) {
    if (seen.has(e.key)) continue;
    seen.add(e.key);
    const value = Math.round(Number(e.amount || 0));
    if (!Number.isFinite(value) || value <= 0) continue;
    if (e.source !== 'scheduled_due') {
      late.count++;
      late.amount += value;
      continue;
    }
    const due = ordinal(e.firstDueDate);
    if (due == null) {
      unknown.count++; unknown.amount += value; continue;
    }
    if (due < now && reported.has(groupId(e))) continue;
    if (due < now) {late.count++; late.amount += value;}
    else if (due <= horizon) {pending.count++; pending.amount += value;}
  }
  return {businessDate, lookAhead, pending, late, unknown};
}

function formatReport(summary, { sourceUpdatedAt, sourceFile, now = new Date() } = {}) {
  const formatter = new Intl.NumberFormat('vi-VN');
  const amount = n => formatter.format(n) + ' đ';
  const date = String(summary.businessDate).split('-').reverse().join('/');
  const sourceTime = sourceUpdatedAt && !Number.isNaN(Date.parse(sourceUpdatedAt))
    ? new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(sourceUpdatedAt))
    : 'không rõ';
  const age = sourceUpdatedAt ? now.getTime() - Date.parse(sourceUpdatedAt) : NaN;
  const warning = (!Number.isFinite(age) || age > 36*60*60*1000)
    ? '\n⚠ Dữ liệu chưa đồng bộ trong 36 giờ: kiểm tra lại QLKH trước khi thu nợ.' : '';
  return [
    '📊 QLKH – BÁO CÁO TỔNG HỢP ' + date,
    '⏳ Sắp đến hạn (0–' + summary.lookAhead + ' ngày): ' + summary.pending.count + ' nghĩa vụ · ' + amount(summary.pending.amount),
    '🔴 Quá hạn chưa xử lý: ' + summary.late.count + ' nghĩa vụ · ' + amount(summary.late.amount),
    ...(summary.unknown.count ? ['⚠ Chưa xác định ngày: ' + summary.unknown.count + ' nghĩa vụ · ' + amount(summary.unknown.amount)] : []),
    '☁ Đồng bộ QLKH: ' + sourceTime,
    '📄 Nguồn: ' + String(sourceFile || 'Excel tổng hợp gần nhất').replace(/[\r\n]/g,' ').slice(0,80),
    warning,
    'Lưu ý: Theo trạng thái ghi nhận trên QLKH; đối chiếu Core Banking trước khi kết luận đã thu/chưa thu.'
  ].filter(Boolean).join('\n');
}

module.exports = {ordinal, buildSummary, formatReport};
