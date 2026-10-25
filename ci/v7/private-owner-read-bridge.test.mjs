import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import {validateReadEnvelope,READ_OPERATION,READ_SCHEMA} from "../../v7-preview/read-contract.js";

const source=readFileSync(new URL("./private-owner-read-bridge.js",import.meta.url),"utf8");
const bookId="1nfJwdzTA99V9WSL6fdCLpMHCnYHqnUJXp505vOjYAsI";
const head=names=>names.split("|");
const rows=()=>({
 "DANH_MUC":[["DANH MỤC QA"],["CHỈ DEMO"],[],head("SKU|TÊN SẢN PHẨM|CÁI/ĐƠN VỊ|ĐƠN VỊ BÁN|GIÁ 1–9"),["QA-SKU-01","Ly PP mẫu","1000","thùng","670.000 ₫"],["QA-SKU-02","Ly chưa kiểm kê","500","thùng",120000]],
 "V7_STOCK_VIEW_QA":[head("SKU|Trạng thái V7|Tồn V7|Đang giữ V7"),["QA-SKU-01","CONFIRMED",12,3],["QA-SKU-02","UNKNOWN","",""]],
 "V7_ORDERS":[head("order_id|customer_id|commercial_state|production_state|delivery_state|payment_status_cache|committed_total_vnd|shipping_policy|created_at_utc"),["QA-ORD-01","QA-CUST-01","COMMITTED","PRINTING","NOT_SCHEDULED","PARTIAL",1000000,"FREE","2026-10-25T04:00:00Z"]],
 "V7_CUSTOMER_PROFILES":[head("customer_id|contact_name|phone"),["QA-CUST-01","Khách QA mô phỏng","0900000000"]],
 "V7_CUSTOMER_BRANDS":[head("brand_id|customer_id|brand_name|is_primary"),["QA-BRAND-01","QA-CUST-01","Thương hiệu mẫu",true]],
 "V7_PAYMENT_LEDGER":[head("order_id|entry_type|amount_vnd|status"),["QA-ORD-01","RECEIPT",400000,"CONFIRMED"],["QA-ORD-01","REVERSAL",50000,"CONFIRMED"],["QA-ORD-01","RECEIPT",100000,"PENDING"]]
});
function run(overrides={}){
 const tables=structuredClone(overrides.tables??rows());
 let attempts=0;
 const fakeBook={
  getName:()=>overrides.bookName??"T015 isolated fault test workbook 2026-10-25",
  getSheetByName:n=>{
   if(!tables[n])return null;
   const grid=tables[n];
   return {
    getLastRow:()=>grid.length,
    getLastColumn:()=>Math.max(...grid.map(row=>row.length)),
    getRange:(r,c,n,columns)=>({
     getValues:()=>grid.slice(r-1,r-1+n).map(row=>row.slice(c-1,c-1+columns))
    })
   };
  }
 };
 const props={
  V7_QA_READ_MODE:"OWNER_ONLY_READ",
  V7_QA_READ_OWNER_EMAIL:"owner@example.invalid",
  V7_QA_READ_BOOK_ID:bookId,
  ...overrides.props
 };
 const sandbox={
  SpreadsheetApp:{openById:id=>{attempts++;assert.equal(id,bookId);return fakeBook}},
  PropertiesService:{getScriptProperties:()=>({getProperty:key=>props[key]??null})},
  Session:{
   getActiveUser:()=>({getEmail:()=>overrides.active??"owner@example.invalid"}),
   getEffectiveUser:()=>({getEmail:()=>overrides.effective??"owner@example.invalid"})
  }
 };
 vm.createContext(sandbox);
 vm.runInContext(source,sandbox,{timeout:1000});
 const request=Object.prototype.hasOwnProperty.call(overrides,"request")?overrides.request:{schema:READ_SCHEMA,operation:READ_OPERATION};
 return {result:sandbox.v7OwnerReadSnapshot(request),accessAttempts:attempts};
}
test("authorized read maps actual QA header structure into contract",()=>{
 const {result,accessAttempts}=run();
 assert.equal(result.ok,true);
 assert.equal(accessAttempts,1);
 const data=validateReadEnvelope(result.envelope,{allowPrivateQa:true,now:Date.now()});
 assert.equal(data.source,"OWNER_QA");
 assert.equal(data.products.length,2);
 assert.equal(data.products[0].priceVnd,670000);
 assert.equal(data.products[0].onHand,12);
 assert.equal(data.products[0].held,3);
 assert.equal(data.products[1].openingConfirmed,false);
 assert.equal(data.products[1].onHand,null);
 assert.equal(data.products[1].held,null);
 assert.equal(data.orders[0].received,350000);
 assert.equal(data.orders[0].total,1000000);
 assert.equal(data.orders[0].brand,"Thương hiệu mẫu");
 assert.equal(data.customers[0].phone,"");
});
test("absent active owner identity fails before workbook read",()=>{
 const r=run({active:""});
 assert.deepEqual(JSON.parse(JSON.stringify(r.result)),{ok:false,error:"AUTH_REQUIRED"});
 assert.equal(r.accessAttempts,0);
});
test("effective account mismatch or wrong Owner rejects",()=>{
 for(const config of [{effective:"bad@example.invalid"},{active:"someone@example.invalid"},{props:{V7_QA_READ_OWNER_EMAIL:"other@example.invalid"}}]){
  const r=run(config);
  assert.equal(r.result.error,"FORBIDDEN");
  assert.equal(r.accessAttempts,0);
 }
});
test("disabled mode, missing property and wrong QA book id reject before opening sheet",()=>{
 const variations=[
  {V7_QA_READ_MODE:"OFF"},
  {V7_QA_READ_OWNER_EMAIL:""},
  {V7_QA_READ_BOOK_ID:"some-other-private-workbook"},
  {V7_QA_READ_BOOK_ID:null}
 ];
 variations.forEach(props=>{
  const r=run({props});
  assert.equal(r.result.error,"FORBIDDEN");
  assert.equal(r.accessAttempts,0);
 });
});
test("unexpected book title, missing tab, or incorrect headers reject without partial response",()=>{
 const wrongTitle=run({bookName:"MAGASIN PRODUCTION"}).result;
 assert.deepEqual(JSON.parse(JSON.stringify(wrongTitle)),{ok:false,error:"FORBIDDEN"});
 const tables=rows();delete tables.V7_PAYMENT_LEDGER;
 assert.equal(run({tables}).result.error,"READ_FAILED");
 const wrong=rows();wrong.V7_ORDERS[0][6]="TOTAL_VND_WRONG";
 assert.equal(run({tables:wrong}).result.error,"READ_FAILED");
});
test("unconfirmed stock is never guessed as zero even if numeric cells contain 0",()=>{
 const tables=rows();tables.V7_STOCK_VIEW_QA[2]=["QA-SKU-02","UNKNOWN",0,0];
 const r=run({tables});assert.equal(r.result.ok,true);
 const product=r.result.envelope.payload.products[1];
 assert.equal(product.openingConfirmed,false);
 assert.equal(product.onHand,null);
 assert.equal(product.held,null);
});
test("confirmed held above on-hand or invalid prices fail closed",()=>{
 const tables=rows();tables.V7_STOCK_VIEW_QA[1][3]=13;
 assert.equal(run({tables}).result.error,"READ_FAILED");
 const noPrice=rows();noPrice.DANH_MUC[4][4]="LIÊN HỆ";
 assert.equal(run({tables:noPrice}).result.error,"READ_FAILED");
});
test("unexpected payment statuses ignored; unknown confirmed entry type rejects",()=>{
 const tables=rows();tables.V7_PAYMENT_LEDGER[3][3]="PENDING";
 const result=run({tables});assert.equal(result.result.ok,true);
 assert.equal(result.result.envelope.payload.orders[0].received,350000);
 tables.V7_PAYMENT_LEDGER.push(["QA-ORD-01","ADJUSTMENT",1000,"CONFIRMED"]);
 assert.equal(run({tables}).result.error,"READ_FAILED");
});
test("reversals exceeding confirmed receipts trigger safe refusal",()=>{
 const tables=rows();tables.V7_PAYMENT_LEDGER[2][2]=500000;
 assert.equal(run({tables}).result.error,"READ_FAILED");
});
test("unrecognized requests never access a workbook",()=>{
 for(const request of [null,{}, {schema:READ_SCHEMA,operation:"POST_ORDER"}, {schema:"v0",operation:READ_OPERATION}]){
  const result=run({request});
  assert.equal(result.result.error,"READ_FAILED");
  assert.equal(result.accessAttempts,0);
 }
});
test("source contains no Apps Script mutation or deployment operations",()=>{
 assert.ok(!/\.\s*(?:appendRow|setValue|setValues|setProperty|setProperties|deleteRow|clearContent|insertRowAfter|createFile)\s*\(/.test(source));
 assert.ok(!/google\.script\.run|UrlFetchApp|MailApp|DriveApp|doGet\s*\(|doPost\s*\(/.test(source));
 assert.ok(!source.includes("owner@example.invalid"));
});
