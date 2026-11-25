'use strict';
// Regression test: synthetic data only; no real customer records or Firebase access.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'qlkh.html'), 'utf8');
const FUNCTIONS = [
  "trackedScheduledKey",
  "trackedScheduledAmount",
  "trackedScheduledDays",
  "trackedScheduledComponentDays",
  "captureScheduledDueLedger",
  "trackedFutureDueRows",
  "sourceOverdueShadowsScheduled",
  "linkedLoanPaidKeys",
  "overdueLedgerRows",
  "overdueTrackerKey",
  "overdueEntryForLoan",
  "loanDueParts",
  "loanDueComponents",
  "groupLoanComponentsByDueDate",
  "makeDueRowFromComponents",
  "due7BaseRows",
  "updateOverdueDays",
  "updateOverdueTrackerPaidFromKeys",
  "setLoanKeysPaid"
];
function extractFunction(name) {
  const start = source.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('Missing function: ' + name);
  const end = source.indexOf('\nfunction ', start + 10);
  if (end < 0) throw new Error('Missing next top-level function after ' + name);
  return source.slice(start, end);
}

const mocks = "\nlet store={},paid={},now='2026-11-23',state={loans:[]};\nfunction todayDate(){return new Date(now+'T00:00:00Z')}\nfunction excelDate(x){if(!x)return null;if(x instanceof Date)return x;const d=new Date(String(x).slice(0,10)+'T00:00:00Z');return Number.isFinite(d.getTime())?d:null}\nfunction dateOrdinal(x){const d=excelDate(x);return d?Math.floor(d.getTime()/86400000):null}\nfunction addDays(x,n){const d=excelDate(x);if(!d)return null;d.setUTCDate(d.getUTCDate()+Number(n));return d}\nfunction dkey(x){const d=excelDate(x);return d?d.toISOString().slice(0,10):''}\nfunction daysDiff(x){const d=dateOrdinal(x);return d===null?null:d-dateOrdinal(todayDate())}\nfunction norm(x){return String(x||'').toLowerCase()}\nfunction isConsumerLoan(r){return String(r.loanType||'').toLowerCase().includes('tieu dung')}\nfunction isBusinessLoan(r){return !isConsumerLoan(r)}\nfunction isMaturityPrincipalRow(){return false}\nfunction businessPayPrincipalInTab13(){return true}\nfunction hasPrincipalOverdue(r){return Number(r.vonQH||0)>0}\nfunction hasInterestOverdue(r){return Number(r.laiQH||0)+Number(r.laiPhat||0)>0}\nfunction loanOverdueInterestAmount(r){return Number(r.laiQH||0)+Number(r.laiPhat||0)}\nfunction loanEffectiveDueDate(r,k){return k==='principal'?r.vonDate:r.laiDate}\nfunction loanEffectiveDays(r,k){return (k==='principal'?hasPrincipalOverdue(r):hasInterestOverdue(r))?-3:daysDiff(k==='principal'?r.vonDate:r.laiDate)}\nfunction overdueTrackedDays(r,k){return trackedScheduledDays(overdueEntryForLoan(r,k))}\nfunction overdueTrackerStore(){return store}\nfunction saveOverdueTrackerStore(x){store=x;return store}\nfunction isOverdueTrackerPaidKey(k){return !!(store[k]&&store[k].status==='paid')}\nfunction loanObligationKey(r,kind,due){return ['loan',kind,r.contract||'',r.maKH||'',norm(r.name||''),dkey(due)].join('|')}\nfunction loanObligationLegacyAmountKey(r,k,due,amount){return loanObligationKey(r,k,due)+'|'+amount}\nfunction isLoanPaid(k){return String(k||'').split('||').every(x=>paid[x]===true)}\nfunction paidStore(){return {loan:paid}}\nfunction loanPaidEntryFromKey(k){return {key:k}}\nfunction paidActiveEntry(){return true}\nfunction paidRestoredEntry(){return false}\nfunction savePaidStore(){}\nfunction renderAll(){}\nfunction invalidateActionCache(){}\nfunction alert(x){throw new Error(x)}\nfunction renderOverdueLedger(){}\nfunction jsq(x){return x}\n";
const scenario = "\nconst loan={maKH:'SYN001',name:'KH TEST',contract:'LD-TEST-001',cbtd:'RM SAMPLE',loanType:'Cho vay tieu dung',vonDate:'2026-11-25',laiDate:'2026-11-25',vonAmount:20000000,laiAmount:1234567,vonQH:0,laiQH:0,laiPhat:0};\nstate.loans=[loan];\ncaptureScheduledDueLedger(state.loans,true);\nlet rows=due7BaseRows(30,false);\nif(rows.length!==1||rows[0].need!==21234567)throw Error('Expected due loan in 30-day list');\nsetLoanKeysPaid(rows[0].key,true,'tab3');\nif(due7BaseRows(30,false).length!==0)throw Error('Paid still visible');\nsetLoanKeysPaid(rows[0].key,false,'tab3');\nif(due7BaseRows(30,false).length!==1)throw Error('Restore failed');\nnow='2026-11-28';\nstate.loans=[{...loan,vonDate:'2026-12-25',laiDate:'2026-12-25'}];\ncaptureScheduledDueLedger(state.loans,true);\nrows=due7BaseRows(30,false);\nconst retained=rows.find(x=>dkey(x.dueDate)==='2026-11-25');\nif(!retained||retained.need!==21234567)throw Error('Old due dropped on Excel rollover');\nupdateOverdueDays(retained.key,'10');\nconst overdue=store[retained.componentKeys[0]];\nif(trackedScheduledDays(overdue)!==10)throw Error('Manual overdue day not retained');\nnow='2026-11-30';\nif(trackedScheduledDays(overdue)!==12)throw Error('Day counter failed to progress');\nsetLoanKeysPaid(retained.key,true,'tab3');\nif(due7BaseRows(30,false).some(x=>dkey(x.dueDate)==='2026-11-25'))throw Error('Paid historic obligation returned');\nreturn {test:'PASS',initialAmount:21234567,daysAtSecondCheck:12};\n";
const script = '(function(){\n' + mocks + '\n' + FUNCTIONS.map(extractFunction).join('\n') + '\n' + scenario + '\n})()';
const result = vm.runInNewContext(script, {}, { timeout: 12000 });
assert.equal(result.test, 'PASS');
assert.equal(result.initialAmount, 21234567);
assert.equal(result.daysAtSecondCheck, 12);

const multiScenario = "\nconst a={maKH:'MULTI01',name:'TEST LOANS',contract:'LD-A',cbtd:'RM SAMPLE',loanType:'Cho vay tieu dung',vonDate:'2026-11-25',laiDate:'2026-11-25',vonAmount:5000000,laiAmount:500000,vonQH:0,laiQH:0,laiPhat:0};\nconst b={...a,contract:'LD-B',vonDate:'2026-11-29',laiDate:'2026-11-29',vonAmount:7000000,laiAmount:700000};\nstate.loans=[a,b];\ncaptureScheduledDueLedger(state.loans,true);\nlet rs=due7BaseRows(30,false);\nif(rs.length!==2)throw new Error('Two different due dates should form distinct rows: '+rs.length);\nconst first=rs.find(r=>r.contract.includes('LD-A'));\nif(!first)throw new Error('Missing contract A');\nsetLoanKeysPaid(first.key,true,'tab3');\nrs=due7BaseRows(30,false);\nif(rs.length!==1||!rs[0].contract.includes('LD-B'))throw new Error('Payment of A hid B');\nreturn {result:'PASS',remaining:rs[0].contract};\n";
const multiScript = '(function(){\n' + mocks + '\n' + FUNCTIONS.map(extractFunction).join('\n') + '\n' + multiScenario + '\n})()';
const multiResult = vm.runInNewContext(multiScript, {}, { timeout: 12000 });
assert.equal(multiResult.result, 'PASS');
assert.equal(multiResult.remaining, 'LD-B');
console.log('PASS: due -> paid -> restored -> Excel rollover -> manually edited overdue days -> paid; and multi-contract isolation');
