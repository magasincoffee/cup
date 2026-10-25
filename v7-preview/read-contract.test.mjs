import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 READ_SCHEMA,READ_OPERATION,ReadContractError,validateReadEnvelope,
 createDemoEnvelope,loadReadOnlySnapshot
} from "./read-contract.js";
import {products,orders,customers} from "./fixtures.js";
const data=()=>({products:structuredClone(products),orders:structuredClone(orders),customers:structuredClone(customers)});
const demo=()=>createDemoEnvelope(data());
const fails=(fn,code)=>assert.throws(fn,e=>e instanceof ReadContractError&&e.code===code);
test("DEMO_PUBLIC snapshot validates, clones, freezes and does not retain unknown keys",()=>{
 const envelope=demo();envelope.payload.products[0].secret="SHOULD_NOT_ESCAPE";
 const snapshot=validateReadEnvelope(envelope);
 assert.equal(snapshot.readOnly,true);
 assert.equal(snapshot.source,"DEMO_PUBLIC");
 assert.equal(snapshot.products.length,5);
 assert.equal(Object.isFrozen(snapshot.products[0]),true);
 assert.equal("secret" in snapshot.products[0],false);
 assert.equal("payload" in snapshot,false);
 assert.equal("canWrite" in snapshot,false);
 envelope.payload.products[0].name="Tampered";
 assert.notEqual(snapshot.products[0].name,"Tampered");
});
test("contracts reject wrong schema, fake readOnly, missing revision and invalid dates",()=>{
 const v=demo();v.schema="V6";fails(()=>validateReadEnvelope(v),"READ_CONTRACT_INVALID");
 const s=demo();s.readOnly=false;fails(()=>validateReadEnvelope(s),"READ_CONTRACT_INVALID");
 const r=demo();r.revision="";fails(()=>validateReadEnvelope(r),"REVISION_REQUIRED");
 const dt=demo();dt.issuedAt="some day";fails(()=>validateReadEnvelope(dt),"ISSUED_AT_INVALID");
});
test("public preview rejects non-DEMO ids and OWNER_QA payloads",()=>{
 const x=demo();x.payload.orders[0].id="REAL-ORDER-1";
 fails(()=>validateReadEnvelope(x),"PUBLIC_DATA_MUST_BE_SYNTHETIC");
 const privateQa={...demo(),source:"OWNER_QA"};
 fails(()=>validateReadEnvelope(privateQa),"PRIVATE_QA_FORBIDDEN_ON_PUBLIC");
});
test("OWNER_QA requires opt-in private context and fresh versioned response",()=>{
 const base={...demo(),source:"OWNER_QA",issuedAt:"2026-10-25T00:01:00.000Z"};
 const now=Date.parse("2026-10-25T00:02:00.000Z");
 assert.equal(validateReadEnvelope(base,{allowPrivateQa:true,now}).source,"OWNER_QA");
 fails(()=>validateReadEnvelope(base,{allowPrivateQa:true,now:now+3600000}),"QA_SNAPSHOT_STALE");
 const future={...base,issuedAt:"2026-10-25T00:05:00.000Z"};
 fails(()=>validateReadEnvelope(future,{allowPrivateQa:true,now}),"QA_SNAPSHOT_STALE");
});
test("unknown initial stock remains null; 0 cannot be used as substitute",()=>{
 const zero=demo();zero.payload.products[1].onHand=0;
 fails(()=>validateReadEnvelope(zero),"UNKNOWN_STOCK_MUST_BE_NULL");
 const held=demo();held.payload.products[0].held=null;
 fails(()=>validateReadEnvelope(held),"CONFIRMED_STOCK_INVALID");
});
test("duplicate SKU, order and customer identity fails closed",()=>{
 for(const [key,field,code] of [["products","sku","DUPLICATE_PRODUCT_ID"],["orders","id","DUPLICATE_ORDER_ID"],["customers","id","DUPLICATE_CUSTOMER_ID"]]){
  const x=demo();x.payload[key][1][field]=x.payload[key][0][field];
  fails(()=>validateReadEnvelope(x),code);
 }
});
test("all VND fields are nonnegative safe integers or intentional null",()=>{
 const a=demo();a.payload.products[0].priceVnd=1.5;
 fails(()=>validateReadEnvelope(a),"PRODUCT_INVALID");
 const b=demo();b.payload.orders[0].received=-5;
 fails(()=>validateReadEnvelope(b),"ORDER_INVALID");
 const c=demo();c.payload.customers[0].debt=Number.MAX_SAFE_INTEGER+1;
 fails(()=>validateReadEnvelope(c),"CUSTOMER_INVALID");
 const d=demo();d.payload.orders[2].total=0;
 assert.equal(validateReadEnvelope(d).orders[2].total,0);
});
test("response rejects malformed/too large collections and excessive strings",()=>{
 const a=demo();a.payload.products=Array(2001).fill(products[0]);
 fails(()=>validateReadEnvelope(a),"INVALID_PRODUCTS_LIST");
 const b=demo();b.payload.orders=null;
 fails(()=>validateReadEnvelope(b),"INVALID_ORDERS_LIST");
 const c=demo();c.payload.products[0].sku="S".repeat(73);
 fails(()=>validateReadEnvelope(c),"PRODUCT_INVALID");
});
test("no outgoing network call in adapter; async injected read receives read-only operation",async()=>{
 let args;
 const response=await loadReadOnlySnapshot(async arg=>{
  args=arg;return {ok:true,envelope:demo()}
 });
 assert.deepEqual(args,{schema:READ_SCHEMA,operation:READ_OPERATION});
 assert.equal(Object.isFrozen(args),true);
 assert.equal(response.orders.length,4);
});
test("read transport handles auth/forbidden/errors without returning a partial snapshot",async()=>{
 await assert.rejects(loadReadOnlySnapshot(async()=>({ok:false,error:"AUTH_REQUIRED"})),
  e=>e.code==="AUTH_REQUIRED");
 await assert.rejects(loadReadOnlySnapshot(async()=>({ok:false,error:"FORBIDDEN"})),
  e=>e.code==="FORBIDDEN");
 await assert.rejects(loadReadOnlySnapshot(async()=>({ok:false,error:"UNKNOWN"})),
  e=>e.code==="READ_FAILED");
 await assert.rejects(loadReadOnlySnapshot(async()=>{throw new Error("private token")}),
  e=>e.code==="READ_TRANSPORT_FAILED"&&!e.message.includes("private token"));
 await assert.rejects(loadReadOnlySnapshot(null),e=>e.code==="READ_TRANSPORT_REQUIRED");
});
test("public source-code has no active API calls and remains synthetic",()=>{
 const contract=readFileSync(new URL("./read-contract.js",import.meta.url),"utf8");
 const app=readFileSync(new URL("./app.js",import.meta.url),"utf8");
 assert.ok(!/\bfetch\s*\(|google\.script\.run|XMLHttpRequest|localStorage|sessionStorage/.test(contract+app));
 assert.ok(!/https:\/\/script\.google\.com\/macros/.test(contract+app));
});

test("catalog price approvals fail closed while missing old metadata stays review-required",()=>{
 const missing=demo();delete missing.payload.products[0].priceApprovalState;
 assert.equal(validateReadEnvelope(missing).products[0].priceApprovalState,"REVIEW_REQUIRED");
 const bad=demo();bad.payload.products[0].priceApprovalState="CHECKED_BY_STAFF";
 fails(()=>validateReadEnvelope(bad),"PRICE_APPROVAL_INVALID");
 const approved=demo();assert.equal(validateReadEnvelope(approved).products[0].priceApprovalState,"APPROVED");
});
