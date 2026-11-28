'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'Code.gs'),'utf8');
const f=vm.runInNewContext(source+'; ({summary:qlkhSummary_,ordinal:qlkhOrdinal_})',{},{timeout:5000});
function loan(key,contract,source,kind,due,amount,status='open'){
 return {key,maKH:'SYNTHETIC',contract,source,kind,firstDueDate:due,amount,status};
}
test('Spark: due/late/paid/future are separate',()=>{
 const t={
 a:loan('a','LD-A','scheduled_due','principal','2026-11-26',1000),
 b:loan('b','LD-B','scheduled_due','interest','2026-11-23',1200),
 c:loan('c','LD-C','scheduled_due','principal','2026-11-30',700),
 d:loan('d','LD-D','scheduled_due','principal','2026-12-09',900),
 e:loan('e','LD-E','scheduled_due','principal','2026-11-28',500,'paid')
 };
 const s=f.summary(t,{loan:{c:{status:'paid',active:true}}},'2026-11-25');
 assert.equal(s.soonCount,1);assert.equal(s.soonAmount,1000);
 assert.equal(s.lateCount,1);assert.equal(s.lateAmount,1200);
});
test('Spark: old due not double counted with reported overdue',()=>{
 const t={
 old:loan('old','LD-Z','scheduled_due','principal','2026-10-25',2000),
 report:loan('report','LD-Z','excel','principal',null,2600),
 other:loan('other','LD-Z','scheduled_due','interest','2026-11-20',100)};
 const s=f.summary(t,{},'2026-11-25');
 assert.equal(s.lateCount,2);assert.equal(s.lateAmount,2700);
});
test('Spark: malformed date and missing date',()=>{
 assert.equal(f.ordinal('2026-02-30'),null);
 const t={a:loan('a','LD-A','scheduled_due','interest',null,101)};
 const s=f.summary(t,{},'2026-11-25');
 assert.equal(s.unknownCount,1);assert.equal(s.soonCount,0);
});
test('Spark: message formatter has no customer/contract interpolation',()=>{
 const formatter=source.slice(source.indexOf('function qlkhFormat_('),source.indexOf('function qlkhSendMessage_('));
 assert.match(source,/PropertiesService\.getScriptProperties\(\)/);
 assert.doesNotMatch(formatter,/\.maKH|\.contract|\.name|\.phone|\.sdt/);
});
