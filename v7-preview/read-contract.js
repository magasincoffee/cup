/**
 * MAGASIN CUP V7: strictly read-only view contract.
 * This is NOT authentication, a Google Apps Script client, or a write bridge.
 * Server-side authorization is mandatory before returning any OWNER_QA payload.
 * Public GitHub Pages MUST ONLY render DEMO_PUBLIC responses.
 */
export const READ_SCHEMA="magasin-cup.v7.read.v1";
export const READ_OPERATION="READ_SNAPSHOT_V1";
const MAX_RECORDS=2000;
const allowedSources=new Set(["DEMO_PUBLIC","OWNER_QA"]);
const isPlainObject=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const isMoney=x=>Number.isSafeInteger(x)&&x>=0;
const isString=(x,max=160)=>typeof x==="string"&&x.length>0&&x.length<=max;
const nullableMoney=x=>x===null||isMoney(x);
export class ReadContractError extends Error{
 constructor(code){super(code);this.name="ReadContractError";this.code=code}
}
const reject=code=>{throw new ReadContractError(code)};
function list(value,name,mapper){
 if(!Array.isArray(value)||value.length>MAX_RECORDS)reject("INVALID_"+name+"_LIST");
 return value.map(mapper);
}
function ensureUnique(rows,key,name){
 const ids=new Set();
 for(const row of rows){
  if(ids.has(row[key]))reject("DUPLICATE_"+name+"_ID");
  ids.add(row[key]);
 }
}
function product(row){
 if(!isPlainObject(row)||!isString(row.sku,72)||!isString(row.name,180)||
  !isString(row.pack,100)||!isString(row.unit,30)||!isMoney(row.priceVnd)||
  typeof row.openingConfirmed!=="boolean")reject("PRODUCT_INVALID");
 const priceApprovalState=row.priceApprovalState===undefined?"REVIEW_REQUIRED":row.priceApprovalState;
 if(priceApprovalState!=="APPROVED"&&priceApprovalState!=="REVIEW_REQUIRED")reject("PRICE_APPROVAL_INVALID");
 if(row.openingConfirmed){
  if(!isMoney(row.onHand)||!isMoney(row.held))reject("CONFIRMED_STOCK_INVALID");
 } else {
  if(row.onHand!==null||row.held!==null)reject("UNKNOWN_STOCK_MUST_BE_NULL");
 }
 return Object.freeze({sku:row.sku,name:row.name,pack:row.pack,unit:row.unit,
  priceVnd:row.priceVnd,priceApprovalState,openingConfirmed:row.openingConfirmed,
  onHand:row.onHand,held:row.held});
}
function order(row){
 if(!isPlainObject(row)||!isString(row.id,72)||!isString(row.customer,180)||
  !isString(row.brand,180)||!isString(row.phase,100)||
  !nullableMoney(row.total)||!isMoney(row.received)||
  !isString(row.ship,120)||!isString(row.date,50))reject("ORDER_INVALID");
 return Object.freeze({id:row.id,customer:row.customer,brand:row.brand,
  phase:row.phase,payment:isString(row.payment,40)?row.payment:"UNKNOWN",
  total:row.total,received:row.received,ship:row.ship,date:row.date});
}
function customer(row){
 if(!isPlainObject(row)||!isString(row.id,72)||!isString(row.name,180)||
  !isString(row.brand,180)||!nullableMoney(row.debt))reject("CUSTOMER_INVALID");
 return Object.freeze({id:row.id,name:row.name,brand:row.brand,
  phone:typeof row.phone==="string"&&row.phone.length<=80?row.phone:"",debt:row.debt});
}
export function validateReadEnvelope(envelope,{allowPrivateQa=false,now=Date.now(),maxAgeMs=300000}={}){
 if(!isPlainObject(envelope)||envelope.schema!==READ_SCHEMA||
  !allowedSources.has(envelope.source)||envelope.readOnly!==true)reject("READ_CONTRACT_INVALID");
 if(envelope.source==="OWNER_QA"&&!allowPrivateQa)reject("PRIVATE_QA_FORBIDDEN_ON_PUBLIC");
 if(!isString(envelope.revision,120))reject("REVISION_REQUIRED");
 if(!isString(envelope.issuedAt,40)||!Number.isFinite(Date.parse(envelope.issuedAt)))
  reject("ISSUED_AT_INVALID");
 const issuedAt=Date.parse(envelope.issuedAt);
 if(envelope.source==="OWNER_QA"&&
  (!Number.isSafeInteger(now)||!Number.isSafeInteger(maxAgeMs)||
   maxAgeMs<=0||issuedAt>now+60000||now-issuedAt>maxAgeMs))reject("QA_SNAPSHOT_STALE");
 if(!isPlainObject(envelope.payload))reject("PAYLOAD_INVALID");
 const products=list(envelope.payload.products,"PRODUCTS",product);
 const orders=list(envelope.payload.orders,"ORDERS",order);
 const customers=list(envelope.payload.customers,"CUSTOMERS",customer);
 ensureUnique(products,"sku","PRODUCT");ensureUnique(orders,"id","ORDER");
 ensureUnique(customers,"id","CUSTOMER");
 if(envelope.source==="DEMO_PUBLIC"&&[
  ...products.map(x=>x.sku),...orders.map(x=>x.id),...customers.map(x=>x.id)
 ].some(id=>!id.startsWith("DEMO-")))reject("PUBLIC_DATA_MUST_BE_SYNTHETIC");
 // Deliberately avoid storing the original payload, hidden credentials,
 // unrecognized fields, metadata or "canWrite" flags.
 return Object.freeze({source:envelope.source,readOnly:true,
  revision:envelope.revision,issuedAt:envelope.issuedAt,
  products:Object.freeze(products),orders:Object.freeze(orders),
  customers:Object.freeze(customers)});
}
export function createDemoEnvelope({products,orders,customers},issuedAt=new Date().toISOString()){
 return {schema:READ_SCHEMA,source:"DEMO_PUBLIC",readOnly:true,
  issuedAt,revision:"demo-fixtures-v1",payload:{products,orders,customers}};
}
/**
 * QA-only injection point. Caller must be a private, authenticated Apps Script
 * environment; passing allowPrivateQa is NOT proof of authorization.
 * This module does not fetch URLs, read tokens, or contact Google by itself.
 */
export async function loadReadOnlySnapshot(readSnapshot,opts={}){
 if(typeof readSnapshot!=="function")reject("READ_TRANSPORT_REQUIRED");
 let response;
 try{
  response=await readSnapshot(Object.freeze({schema:READ_SCHEMA,operation:READ_OPERATION}));
 }catch{reject("READ_TRANSPORT_FAILED")}
 if(!isPlainObject(response)||response.ok!==true){
  if(response?.error==="AUTH_REQUIRED")reject("AUTH_REQUIRED");
  if(response?.error==="FORBIDDEN")reject("FORBIDDEN");
  reject("READ_FAILED");
 }
 return validateReadEnvelope(response.envelope,opts);
}
