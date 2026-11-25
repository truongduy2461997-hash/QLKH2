'use strict';

const {test} = require('node:test');
const assert = require('node:assert/strict');
const {buildSummary,formatReport,ordinal} = require('./report.cjs');
const date = '2026-11-25';

function item(key, more) {
  return {key,source:'scheduled_due',kind:'principal',status:'open',
    maKH:'TEST-CIF',contract:'TEST-CONTRACT',amount:1000,firstDueDate:'2026-11-25',...more};
}

test('upcoming, late and paid are separate', () => {
  const overdueTracker = {
    a:item('a',{firstDueDate:'2026-11-25',amount:1000}),
    b:item('b',{firstDueDate:'2026-11-20',kind:'interest',amount:1200}),
    c:item('c',{firstDueDate:'2026-11-28',amount:1500}),
    d:item('d',{firstDueDate:'2026-11-28',amount:1900,status:'paid'}),
    e:item('e',{firstDueDate:'2026-12-10',amount:900}),
    f:item('f',{firstDueDate:'2026-11-29',amount:550})
  };
  const paid = {loan:{f:{status:'paid',active:true}}};
  const result = buildSummary({overdueTracker,paid,businessDate:date});
  assert.deepEqual(result.pending,{count:2,amount:2500});
  assert.deepEqual(result.late,{count:1,amount:1200});
});

test('source-reported overdue suppresses same old scheduled due', () => {
  const tracker = {
    older:item('older',{amount:3000,firstDueDate:'2026-10-25'}),
    current:item('current',{source:'excel',amount:4100,firstDueDate:'2026-10-25'})
  };
  const result = buildSummary({overdueTracker:tracker,businessDate:date});
  assert.equal(result.late.count,1);
  assert.equal(result.late.amount,4100);
});

test('different contracts remain separate', () => {
  const ledger = {
    a:item('a',{contract:'TEST-LD-A',amount:100}),
    b:item('b',{contract:'TEST-LD-B',amount:250})
  };
  assert.deepEqual(buildSummary({overdueTracker:ledger,businessDate:date}).pending,{count:2,amount:350});
});

test('unknown due date is not silently treated as a scheduled payment', () => {
  const tracker = {a:item('a',{firstDueDate:null,amount:999})};
  const r = buildSummary({overdueTracker:tracker,businessDate:date});
  assert.deepEqual(r.unknown,{count:1,amount:999});
  assert.equal(r.pending.count,0);
});

test('invalid calendar dates are rejected', () => {
  assert.equal(ordinal('2026-02-30'),null);
  assert.equal(ordinal('2026-12-01'),Math.floor(Date.UTC(2026,11,1)/86400000));
});

test('message excludes account identifiers and warns when sync is stale', () => {
  const tracker={a:item('a',{maKH:'SENSITIVE123',name:'PRIVATE PERSON',contract:'LD-PRIVATE'})};
  const summary=buildSummary({overdueTracker:tracker,businessDate:date});
  const text=formatReport(summary,{
    sourceUpdatedAt:'2026-11-22T01:00:00Z',
    now:new Date('2026-11-25T01:00:00Z')
  });
  assert.match(text,/Sắp đến hạn/);
  assert.match(text,/Dữ liệu chưa đồng bộ/);
  assert.doesNotMatch(text,/SENSITIVE123|PRIVATE PERSON|LD-PRIVATE/);
});
