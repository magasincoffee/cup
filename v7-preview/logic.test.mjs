import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {calculateQuote,derivePaymentStatus,stockAvailability,escapeHtml} from "./logic.js";
import {products,orders,customers} from "./fixtures.js";
const cart=[{sku:"DEMO-PP700-01",quantity:2,unitPriceVnd:400000}];
test("four shipping modes are explicit; PENDING cannot create official total",()=>{
 const pending=calculateQuote(cart);
 assert.equal(pending.officialTotalVnd,null);assert.equal(pending.quoteReady,false);
 for(const mode of ["FREE","INCLUDED"]){const q=calculateQuote(cart,{shippingMode:mode});assert.equal(q.officialTotalVnd,800000);assert.equal(q.shippingVnd,0);assert.equal(q.quoteReady,true)}
 const separate=calculateQuote(cart,{shippingMode:"SEPARATE",shippingFeeVnd:35000});
 assert.equal(separate.officialTotalVnd,835000);
});
test("price negotiation, printing fee, discount are per-line and integer VND",()=>{
 const q=calculateQuote(cart,{shippingMode:"SEPARATE",shippingFeeVnd:25000,printFeeVnd:150000,discountVnd:70000});
 assert.equal(q.subtotalVnd,800000);assert.equal(q.officialTotalVnd,905000);
 assert.equal(products[0].priceVnd,450000); // negotiated price must not mutate catalog
});
test("invalid shipping, discount, money, quantities fail closed",()=>{
 assert.throws(()=>calculateQuote(cart,{shippingMode:"AUTO"}),/SHIPPING_MODE_INVALID/);
 assert.throws(()=>calculateQuote(cart,{shippingMode:"SEPARATE",shippingFeeVnd:-1}),/SHIPPING_FEE_INVALID/);
 assert.throws(()=>calculateQuote(cart,{shippingMode:"FREE",discountVnd:900000}),/DISCOUNT_INVALID/);
 assert.throws(()=>calculateQuote([{sku:"DEMO-A",quantity:1.5,unitPriceVnd:1}]),/LINE_INVALID/);
 assert.throws(()=>calculateQuote([{sku:"DEMO-A",quantity:1,unitPriceVnd:10.5}]),/LINE_INVALID/);
 assert.throws(()=>calculateQuote([{sku:"",quantity:1,unitPriceVnd:1}]),/SKU_REQUIRED/);
 assert.throws(()=>calculateQuote([{sku:"DEMO-A",quantity:Number.MAX_SAFE_INTEGER,unitPriceVnd:5}]),/TOTAL_OVERFLOW/);
});
test("draft with no items cannot be committed by quote-ready status",()=>{
 const q=calculateQuote([],{shippingMode:"FREE"});
 assert.equal(q.quoteReady,false);
});
test("only confirmed receipts influence net collections and debt",()=>{
 const r=derivePaymentStatus(1000000,[
 {state:"CONFIRMED",amountVnd:600000},{state:"DRAFT",amountVnd:300000},
 {state:"REVERSAL_CONFIRMED",amountVnd:100000}]);
 assert.deepEqual(r,{netReceivedVnd:500000,balanceVnd:500000,status:"PARTIAL"});
 assert.equal(derivePaymentStatus(null,[]).status,"TOTAL_PENDING");
 assert.equal(derivePaymentStatus(100,[]).status,"UNPAID");
 assert.equal(derivePaymentStatus(100,[{state:"CONFIRMED",amountVnd:100}]).status,"PAID");
 assert.equal(derivePaymentStatus(100,[{state:"CONFIRMED",amountVnd:120}]).status,"OVERPAID");
 assert.throws(()=>derivePaymentStatus(100,[{state:"REVERSAL_CONFIRMED",amountVnd:1}]),/REVERSAL_EXCEEDS_RECEIPTS/);
});
test("unknown opening stock remains unknown rather than zero",()=>{
 assert.deepEqual(stockAvailability(products[1]),{state:"UNKNOWN",available:null});
 assert.deepEqual(stockAvailability(products[4]),{state:"OUT",available:0});
 assert.deepEqual(stockAvailability(products[0]),{state:"KNOWN",available:10});
 assert.deepEqual(stockAvailability({openingConfirmed:true,onHand:2,held:3}),{state:"RECONCILE",available:null});
});
test("user-generated content is escaped",()=>{
 assert.equal(escapeHtml('<img src=x onerror="alert(1)">'),'&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
 assert.equal(escapeHtml("& '"),"&amp; &#39;");
});
test("all preview records are synthetic and isolated",()=>{
 for(const p of products)assert.match(p.sku,/^DEMO-/);
 for(const o of orders)assert.match(o.id,/^DEMO-/);
 for(const c of customers)assert.match(c.id,/^DEMO-/);
});
test("preview has no network/write adapters and disables real write controls",()=>{
 const app=readFileSync(new URL("./app.js",import.meta.url),"utf8");
 const html=readFileSync(new URL("./index.html",import.meta.url),"utf8");
 assert.ok(!/\bfetch\s*\(|google\.script\.run|XMLHttpRequest|localStorage|sessionStorage/.test(app));
 assert.ok(!/https:\/\/script\.google\.com\/macros/.test(html+app));
 for(const action of ["Lưu đơn","Chốt đơn","Nhập kho","Xuất kho"])assert.ok(app.includes(action));
 assert.ok(app.includes("disabled"));
 assert.ok(html.includes("DEMO · KHÔNG GHI"));
});
