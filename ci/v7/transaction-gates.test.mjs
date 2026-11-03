import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareOrderIntent,prepareReceiptIntent} from './transaction-gates.mjs';
const item={sku:'SKU-700',name:'Ly 700',priceVnd:400000,priceApprovalState:'APPROVED',openingConfirmed:true,onHand:10,held:2};
const args=()=>({requestKey:'request001',orderId:'order0001',customerId:'customer0001',lines:[{sku:'SKU-700',quantity:2,unitPriceVnd:400000}],terms:{shippingMode:'FREE'},products:[item]});
test('confirmed approved order creates only an immutable intent, never a write',()=>{
 const a=prepareOrderIntent(args());
 assert.equal(a.totalVnd,800000);
 assert.equal(a.reservations[0].quantity,2);
 assert.equal(a.type,'ORDER_COMMIT_INTENT_V1');
 assert.ok(Object.isFrozen(a));
});
test('unknown or insufficient stock and unapproved policy fail closed',()=>{
 assert.throws(()=>prepareOrderIntent({...args(),products:[{...item,openingConfirmed:false,onHand:null,held:null}]}),/OPENING_STOCK_UNCONFIRMED/);
 assert.throws(()=>prepareOrderIntent({...args(),products:[{...item,onHand:2,held:1}]}),/INSUFFICIENT_STOCK/);
 assert.throws(()=>prepareOrderIntent({...args(),stockPolicy:'ALLOW_NEGATIVE'}),/STOCK_POLICY_UNAPPROVED/);
});
test('unapproved reference or negotiated price require explicit external approval',()=>{
 assert.throws(()=>prepareOrderIntent({...args(),products:[{...item,priceApprovalState:'REVIEW_REQUIRED'}]}),/PRICE_APPROVAL_REQUIRED/);
 const negotiated={...args(),lines:[{sku:'SKU-700',quantity:2,unitPriceVnd:350000}]};
 assert.throws(()=>prepareOrderIntent(negotiated),/PRICE_APPROVAL_REQUIRED/);
 assert.equal(prepareOrderIntent({...negotiated,priceApprovals:{'SKU-700':true}}).totalVnd,700000);
});
test('pending delivery fee and empty cart cannot become official orders',()=>{
 assert.throws(()=>prepareOrderIntent({...args(),terms:{shippingMode:'PENDING'}}),/TOTAL_NOT_FINAL/);
 assert.throws(()=>prepareOrderIntent({...args(),lines:[]}),/LINES_INVALID/);
});
test('duplicate SKU, catalog duplication, unknown SKU and invalid ids rejected',()=>{
 assert.throws(()=>prepareOrderIntent({...args(),lines:[...args().lines,...args().lines]}),/DUPLICATE_ORDER_SKU/);
 assert.throws(()=>prepareOrderIntent({...args(),products:[item,item]}),/CATALOG_DUPLICATE_OR_INVALID/);
 assert.throws(()=>prepareOrderIntent({...args(),lines:[{sku:'MISSING',quantity:1,unitPriceVnd:1}]}),/UNKNOWN_SKU/);
 assert.throws(()=>prepareOrderIntent({...args(),requestKey:''}),/IDENTIFIER_INVALID/);
});
test('partial receipts can be prepared; overpayment and unconfirmed totals refused',()=>{
 const receipt={requestKey:'payment001',orderId:'order0001',amountVnd:100000,officialTotalVnd:500000,confirmedLedger:[{state:'CONFIRMED',amountVnd:250000}]};
 assert.equal(prepareReceiptIntent(receipt).amountVnd,100000);
 assert.throws(()=>prepareReceiptIntent({...receipt,amountVnd:300000}),/PAYMENT_EXCEEDS_BALANCE/);
 assert.throws(()=>prepareReceiptIntent({...receipt,officialTotalVnd:null}),/TOTAL_NOT_FINAL/);
});
test('intent module has no persistence, deployment or external service access',async()=>{
 const {readFileSync}=await import('node:fs');
 const s=readFileSync(new URL('./transaction-gates.mjs',import.meta.url),'utf8');
 assert.ok(!/SpreadsheetApp|PropertiesService|LockService|google\.script\.run|UrlFetchApp|\bfetch\s*\(/.test(s));
});
