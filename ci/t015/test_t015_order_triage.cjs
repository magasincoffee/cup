'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx={t12Owner_(){return true},v7T015StockOrderProjection(){return fixture()}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname+'/T015_OrderTriage.js','utf8'),ctx);
const line=(id,status,stockStatus='CONFIRMED')=>({lineId:'line-'+id,sku:'SKU',status,stockStatus,quantity:2,
 issued:status==='PARTIALLY_ISSUED'?1:0,held:0,remainingToIssue:status==='PARTIALLY_ISSUED'?1:2});
function order(id,commercial,projection,stored,status,stockStatus){
 return {orderId:id,commercialState:commercial,projectedInventoryState:projection,
  persistedInventoryState:stored,disagreesWithStored:projection!==stored,
  lines:[line(id,status,stockStatus)]};
}
function fixture(){return {version:'QA',writeGateOpen:false,orders:[
 order('PARTIAL','CONFIRMED','PARTIALLY_ISSUED','UNRESERVED','PARTIALLY_ISSUED'),
 order('UNKNOWN1','CONFIRMED','STOCK_UNKNOWN','UNRESERVED','STOCK_UNKNOWN','UNKNOWN'),
 order('DRAFT','DRAFT','DRAFT','UNRESERVED','UNRESERVED'),
 order('UNKNOWN2','CONFIRMED','STOCK_UNKNOWN','UNRESERVED','STOCK_UNKNOWN','UNKNOWN')
]}}
let n=0;
function test(label,fn){fn();n++;console.log('PASS '+label)}
test('classify original QA 4 orders as 1/2/1',()=>{
 const r=ctx.t15ViewTriage_(fixture());
 assert.deepEqual(JSON.parse(JSON.stringify(r.counts)),
 {actionable:1,openingUnconfirmed:2,draft:1,requiresManualReconciliation:0,matching:0,total:4});
});
test('partial issue actionable',()=>assert.equal(ctx.t15ViewTriage_(fixture()).orders[0].requiresOrderStateReview,true));
test('unknown opening not actionable',()=>assert.equal(ctx.t15ViewTriage_(fixture()).orders[1].requiresOrderStateReview,false));
test('draft not actionable',()=>assert.equal(ctx.t15ViewTriage_(fixture()).orders[2].requiresOrderStateReview,false));
test('quarantined source manual',()=>{const p=fixture();p.orders[0].lines[0].stockStatus='QUARANTINED';assert.equal(ctx.t15ViewTriage_(p).counts.requiresManualReconciliation,1)});
test('line needs review manual',()=>{const p=fixture();p.orders[0].lines[0].status='NEEDS_REVIEW';assert.equal(ctx.t15ViewTriage_(p).counts.requiresManualReconciliation,1)});
test('zero lines manual',()=>{const p=fixture();p.orders[0].lines=[];assert.equal(ctx.t15ViewTriage_(p).counts.requiresManualReconciliation,1)});
test('matching stored state',()=>{const p=fixture();p.orders[0]=order('MATCH','CONFIRMED','UNRESERVED','UNRESERVED','UNRESERVED');assert.equal(ctx.t15ViewTriage_(p).counts.matching,1)});
test('duplicate orders fail',()=>{const p=fixture();p.orders.push(p.orders[0]);assert.throws(()=>ctx.t15ViewTriage_(p),/DUPLICATE_ORDER/)});
test('does not mutate projection',()=>{const p=fixture(),before=JSON.stringify(p);ctx.t15ViewTriage_(p);assert.equal(JSON.stringify(p),before)});
test('open write gate warned',()=>{const p=fixture();p.writeGateOpen=true;assert.equal(ctx.t15ViewTriage_(p).writeGateWarning,'WRITE_GATE_OPEN')});
test('Owner endpoint read-only',()=>assert.equal(ctx.v7T015OrderTriageQA().readOnly,true));
console.log('TOTAL '+n+'/12 PASS');
