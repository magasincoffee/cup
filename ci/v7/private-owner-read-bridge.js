/**
 * MAGASIN CUP V7 — ISOLATED OWNER-ONLY READ BRIDGE DRAFT.
 *
 * Intended for manual review and installation ONLY in an authorized private
 * QA Apps Script project. This file in GitHub is NOT deployed or connected
 * to a live Apps Script. Never deploy this as a public Web App.
 *
 * Required Script Properties of the private project:
 *   V7_QA_READ_MODE=OWNER_ONLY_READ
 *   V7_QA_READ_OWNER_EMAIL=<verified Owner email>
 *   V7_QA_READ_BOOK_ID=<exact isolated workbook ID>
 *
 * Fail closed: missing identities, wrong workbook, malformed schema or
 * non-numeric money => no partial data.
 */
var V7_READ_SCHEMA = 'magasin-cup.v7.read.v1';
var V7_READ_OP = 'READ_SNAPSHOT_V1';
var V7_QA_EXPECTED_BOOK = '1nfJwdzTA99V9WSL6fdCLpMHCnYHqnUJXp505vOjYAsI';
var V7_QA_EXPECTED_TITLE = 'T015 isolated fault test workbook 2026-10-25';
var V7_QA_MAX_ROWS = 2000;
function v7_qFail(code){var err=new Error(code);err.v7Code=code;throw err}
function v7_qStr(v){return String(v===null||v===undefined?'':v).trim()}
function v7_qText(v,max){
 var s=v7_qStr(v);if(!s||s.length>max)v7_qFail('READ_SCHEMA_INVALID');return s;
}
function v7_qMoney(v,nullable){
 if((v===null||v===undefined||v==='')&&nullable)return null;
 if(typeof v==='number'){
  if(!Number.isSafeInteger(v)||v<0)v7_qFail('READ_MONEY_INVALID');
  return v;
 }
 var s=v7_qStr(v).replace(/[\u00a0\u202f ]/g,'');
 if(/^\d{1,3}(?:\.\d{3})+(?:₫)?$/.test(s))
  s=s.replace(/\./g,'').replace(/₫$/,'');
 if(!/^\d+$/.test(s))v7_qFail('READ_MONEY_INVALID');
 var n=Number(s);
 if(!Number.isSafeInteger(n)||n<0)v7_qFail('READ_MONEY_INVALID');
 return n;
}
function v7_qNumOrNull(v){
 if(v===null||v===undefined||v==='')return null;
 return v7_qMoney(v,false);
}
function v7_qSheets(book,title,required,headerRow){
 var sheet=book.getSheetByName(title);
 if(!sheet)v7_qFail('READ_SCHEMA_INVALID');
 var last=sheet.getLastRow(),columns=sheet.getLastColumn();
 if(!Number.isInteger(last)||last<headerRow||last>V7_QA_MAX_ROWS||
  !Number.isInteger(columns)||columns<1||columns>50)v7_qFail('READ_SCHEMA_INVALID');
 var values=sheet.getRange(headerRow,1,last-headerRow+1,columns).getValues();
 if(!values.length)v7_qFail('READ_SCHEMA_INVALID');
 var header=values.shift().map(function(x){return v7_qStr(x)});
 var indexes={};
 header.forEach(function(k,i){if(k)indexes[k]=i});
 required.forEach(function(k){if(indexes[k]===undefined)v7_qFail('READ_SCHEMA_INVALID')});
 var rows=[];
 values.forEach(function(line){
  if(line.every(function(v){return v===null||v===undefined||v==='' }))return;
  var obj={};required.forEach(function(key){obj[key]=line[indexes[key]]});
  rows.push(obj);
 });
 return rows;
}
function v7_qMapBy(rows,key){
 var result=Object.create(null);
 rows.forEach(function(row){
  var id=v7_qText(row[key],100);
  if(Object.prototype.hasOwnProperty.call(result,id))v7_qFail('READ_DUPLICATE_ID');
  result[id]=row;
 });
 return result;
}
function v7_qAuthorize(){
 var props=PropertiesService.getScriptProperties();
 if(!props||props.getProperty('V7_QA_READ_MODE')!=='OWNER_ONLY_READ')
  v7_qFail('FORBIDDEN');
 var owner=v7_qStr(props.getProperty('V7_QA_READ_OWNER_EMAIL')).toLowerCase();
 var configuredBook=v7_qStr(props.getProperty('V7_QA_READ_BOOK_ID'));
 if(!owner||!owner.includes('@'))v7_qFail('FORBIDDEN');
 // ActiveUser email may be blank for some Apps Script deployments:
 // do not fall back to effective account (it would authorize everyone).
 var active=v7_qStr(Session.getActiveUser().getEmail()).toLowerCase();
 if(!active)v7_qFail('AUTH_REQUIRED');
 var effective=v7_qStr(Session.getEffectiveUser().getEmail()).toLowerCase();
 if(active!==owner||effective!==owner)v7_qFail('FORBIDDEN');
 if(configuredBook!==V7_QA_EXPECTED_BOOK)v7_qFail('FORBIDDEN');
 return configuredBook;
}
function v7_qBuildEnvelope(book){
 if(book.getName()!==V7_QA_EXPECTED_TITLE)v7_qFail('FORBIDDEN');
 var cat=v7_qSheets(book,'DANH_MUC',
   ['SKU','TÊN SẢN PHẨM','CÁI/ĐƠN VỊ','ĐƠN VỊ BÁN','GIÁ 1–9'],4);
 var stock=v7_qSheets(book,'V7_STOCK_VIEW_QA',
   ['SKU','Trạng thái V7','Tồn V7','Đang giữ V7'],1);
 var ordersRaw=v7_qSheets(book,'V7_ORDERS',
   ['order_id','customer_id','commercial_state','production_state',
   'delivery_state','payment_status_cache','committed_total_vnd',
   'shipping_policy','created_at_utc'],1);
 var profile=v7_qSheets(book,'V7_CUSTOMER_PROFILES',
   ['customer_id','contact_name','phone'],1);
 var brands=v7_qSheets(book,'V7_CUSTOMER_BRANDS',
   ['brand_id','customer_id','brand_name','is_primary'],1);
 var ledger=v7_qSheets(book,'V7_PAYMENT_LEDGER',
   ['order_id','entry_type','amount_vnd','status'],1);
 var stockIndex=v7_qMapBy(stock,'SKU');
 var profileIndex=v7_qMapBy(profile,'customer_id');
 var primaryBrands=Object.create(null);
 brands.forEach(function(b){
  var cid=v7_qStr(b.customer_id);
  if(!cid)return;
  if(!primaryBrands[cid]||
      b.is_primary===true||v7_qStr(b.is_primary).toUpperCase()==='TRUE')
   primaryBrands[cid]=v7_qStr(b.brand_name);
 });
 var products=cat.map(function(c){
  var sku=v7_qText(c.SKU,72), entry=stockIndex[sku];
  var confirmed=!!entry&&v7_qStr(entry['Trạng thái V7']).toUpperCase()==='CONFIRMED';
  var onHand=confirmed?v7_qNumOrNull(entry['Tồn V7']):null;
  var held=confirmed?v7_qNumOrNull(entry['Đang giữ V7']):null;
  if(confirmed&&(onHand===null||held===null||held>onHand))
   v7_qFail('READ_STOCK_RECONCILIATION_REQUIRED');
  return {
   sku:sku,name:v7_qText(c['TÊN SẢN PHẨM'],180),
   pack:v7_qText(c['CÁI/ĐƠN VỊ'],100)+' cái/'+v7_qText(c['ĐƠN VỊ BÁN'],30),
   unit:v7_qText(c['ĐƠN VỊ BÁN'],30),
   priceVnd:v7_qMoney(c['GIÁ 1–9'],false),
   openingConfirmed:confirmed,onHand:onHand,held:held
  };
 });
 var receipts=Object.create(null);
 ledger.forEach(function(p){
  if(v7_qStr(p.status).toUpperCase()!=='CONFIRMED')return;
  var orderId=v7_qText(p.order_id,72);
  var kind=v7_qStr(p.entry_type).toUpperCase();
  var amount=v7_qMoney(p.amount_vnd,false);
  if(kind==='RECEIPT')receipts[orderId]=(receipts[orderId]||0)+amount;
  else if(kind==='REVERSAL')receipts[orderId]=(receipts[orderId]||0)-amount;
  else v7_qFail('READ_PAYMENT_KIND_UNKNOWN');
  if(!Number.isSafeInteger(receipts[orderId])||receipts[orderId]<0)
   v7_qFail('READ_PAYMENT_RECONCILIATION_REQUIRED');
 });
 var orders=ordersRaw.map(function(o){
  var customerId=v7_qText(o.customer_id,72);
  var c=profileIndex[customerId];
  var total=v7_qNumOrNull(o.committed_total_vnd);
  var amount=receipts[v7_qStr(o.order_id)]||0;
  return {
   id:v7_qText(o.order_id,72),
   customer:c&&v7_qStr(c.contact_name)?v7_qText(c.contact_name,180):'Khách '+customerId,
   brand:primaryBrands[customerId]||'Chưa có thương hiệu',
   phase:v7_qText(o.production_state||o.commercial_state,100),
   payment:v7_qText(o.payment_status_cache||'UNKNOWN_TOTAL',40),
   total:total,received:amount,
   ship:v7_qText(o.delivery_state||'Chưa xác định',120),
   date:v7_qText(o.created_at_utc||'Chưa rõ',50)
  };
 });
 var customers=profile.map(function(c){
  var id=v7_qText(c.customer_id,72);
  // Phone and contact details should not be exposed by generic read views.
  return {id:id,name:v7_qText(c.contact_name,180),
   brand:primaryBrands[id]||'Chưa có thương hiệu',
   phone:'',debt:null};
 });
 var stamp=new Date().toISOString();
 return {schema:V7_READ_SCHEMA,source:'OWNER_QA',readOnly:true,
  revision:'qa-read-'+stamp,issuedAt:stamp,
  payload:{products:products,orders:orders,customers:customers}};
}
/** Invoked only from a private Owner-only Apps Script HTML session. */
function v7OwnerReadSnapshot(request){
 try{
  if(!request||request.schema!==V7_READ_SCHEMA||request.operation!==V7_READ_OP)
   v7_qFail('READ_FAILED');
  var bookId=v7_qAuthorize();
  var book=SpreadsheetApp.openById(bookId);
  return {ok:true,envelope:v7_qBuildEnvelope(book)};
 }catch(e){
  var code=e&&e.v7Code;
  return {ok:false,error:
   code==='AUTH_REQUIRED'?'AUTH_REQUIRED':
   code==='FORBIDDEN'?'FORBIDDEN':'READ_FAILED'};
 }
}
