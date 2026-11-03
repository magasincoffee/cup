// MAGASIN CUP V7 — transaction acceptance gate (pure validation, NO writes).
// Must be invoked only after server-side authorization, lock and revision check.
// Returning an intent is NOT committing an order; persistence must implement a
// durable idempotency ledger, atomic journal and recovery separately.
import {calculateQuote,stockAvailability,derivePaymentStatus} from '../../v7-preview/logic.js';
const fail=code=>{throw new Error(code)};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{7,119}$/.test(x);
const money=x=>Number.isSafeInteger(x)&&x>=0;
export function prepareOrderIntent({requestKey,orderId,customerId,lines,terms,products,priceApprovals={},stockPolicy='REQUIRE_CONFIRMED'}){
 if(!id(requestKey)||!id(orderId)||!id(customerId))fail('IDENTIFIER_INVALID');
 if(!Array.isArray(lines)||lines.length===0||lines.length>100)fail('LINES_INVALID');
 if(!Array.isArray(products))fail('CATALOG_INVALID');
 if(stockPolicy!=='REQUIRE_CONFIRMED')fail('STOCK_POLICY_UNAPPROVED');
 const catalog=new Map();
 for(const item of products){
  if(!item||typeof item.sku!=='string'||catalog.has(item.sku))fail('CATALOG_DUPLICATE_OR_INVALID');
  catalog.set(item.sku,item);
 }
 const seen=new Set(),reserved=[];
 for(const line of lines){
  if(!line||typeof line.sku!=='string'||seen.has(line.sku))fail('DUPLICATE_ORDER_SKU');
  seen.add(line.sku);
  const product=catalog.get(line.sku);
  if(!product)fail('UNKNOWN_SKU');
  if(!Number.isSafeInteger(line.quantity)||line.quantity<=0||!money(line.unitPriceVnd))fail('LINE_INVALID');
  // Price approval is mandatory. No client-provided or catalog marker can
  // silently approve a negotiated price; external verified approval is required.
  if(product.priceApprovalState!=='APPROVED'||
    line.unitPriceVnd!==product.priceVnd){
   if(priceApprovals[line.sku]!==true)fail('PRICE_APPROVAL_REQUIRED');
  }
  const availability=stockAvailability(product);
  if(availability.state==='UNKNOWN')fail('OPENING_STOCK_UNCONFIRMED');
  if(availability.state==='RECONCILE')fail('STOCK_RECONCILIATION_REQUIRED');
  if(availability.available<line.quantity)fail('INSUFFICIENT_STOCK');
  reserved.push(Object.freeze({sku:line.sku,quantity:line.quantity}));
 }
 const quote=calculateQuote(lines,terms);
 if(!quote.quoteReady||quote.officialTotalVnd===null)fail('TOTAL_NOT_FINAL');
 return Object.freeze({type:'ORDER_COMMIT_INTENT_V1',requestKey,orderId,customerId,
  lines: Object.freeze(lines.map(x=>Object.freeze({sku:x.sku,quantity:x.quantity,unitPriceVnd:x.unitPriceVnd}))),
  reservations:Object.freeze(reserved),totalVnd:quote.officialTotalVnd,
  shippingMode:quote.shippingMode});
}
export function prepareReceiptIntent({requestKey,orderId,amountVnd,officialTotalVnd,confirmedLedger=[]}){
 if(!id(requestKey)||!id(orderId)||!money(amountVnd)||amountVnd===0)fail('RECEIPT_INVALID');
 if(!money(officialTotalVnd))fail('TOTAL_NOT_FINAL');
 const {netReceivedVnd}=derivePaymentStatus(officialTotalVnd,confirmedLedger);
 if(!Number.isSafeInteger(netReceivedVnd+amountVnd)||netReceivedVnd+amountVnd>officialTotalVnd)
  fail('PAYMENT_EXCEEDS_BALANCE');
 return Object.freeze({type:'RECEIPT_INTENT_V1',requestKey,orderId,amountVnd});
}
