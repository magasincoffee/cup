// MAGASIN CUP V7 — pure quote and display rules (demo only; never an API write).
export const SHIPPING_MODES=Object.freeze(["INCLUDED","FREE","SEPARATE","PENDING"]);
const validMoney=v=>Number.isSafeInteger(v)&&v>=0;
const validQty=v=>Number.isSafeInteger(v)&&v>0;
export function calculateQuote(lines,{shippingMode="PENDING",shippingFeeVnd=0,printFeeVnd=0,discountVnd=0}={}){
 if(!SHIPPING_MODES.includes(shippingMode))throw Error("SHIPPING_MODE_INVALID");
 if(!Array.isArray(lines))throw Error("LINES_INVALID");
 if(!validMoney(printFeeVnd)||!validMoney(discountVnd))throw Error("MONEY_INVALID");
 let subtotalVnd=0;
 for(const line of lines){
  if(!line||typeof line.sku!=="string"||!line.sku.trim())throw Error("SKU_REQUIRED");
  if(!validQty(line.quantity)||!validMoney(line.unitPriceVnd))throw Error("LINE_INVALID");
  const sum=line.quantity*line.unitPriceVnd;
  if(!Number.isSafeInteger(sum)||!Number.isSafeInteger(subtotalVnd+sum))throw Error("TOTAL_OVERFLOW");
  subtotalVnd+=sum;
 }
 if(shippingMode==="SEPARATE"&&!validMoney(shippingFeeVnd))throw Error("SHIPPING_FEE_INVALID");
 const shippingVnd=shippingMode==="SEPARATE"?shippingFeeVnd:0;
 const beforeDiscount=subtotalVnd+printFeeVnd+shippingVnd;
 if(!Number.isSafeInteger(beforeDiscount)||discountVnd>beforeDiscount)throw Error("DISCOUNT_INVALID");
 const provisionalVnd=subtotalVnd+printFeeVnd-discountVnd;
 return Object.freeze({
  subtotalVnd,printFeeVnd,discountVnd,shippingMode,shippingVnd,
  // PENDING shipping cannot produce an authoritative order total.
  officialTotalVnd:shippingMode==="PENDING"?null:beforeDiscount-discountVnd,
  provisionalVnd,quoteReady:lines.length>0&&shippingMode!=="PENDING"
 });
}
export function derivePaymentStatus(officialTotalVnd,receipts=[]){
 if(officialTotalVnd!==null&&!validMoney(officialTotalVnd))throw Error("TOTAL_INVALID");
 let netReceivedVnd=0;
 for(const r of receipts){
  if(!r||!validMoney(r.amountVnd))throw Error("RECEIPT_INVALID");
  if(r.state==="CONFIRMED")netReceivedVnd+=r.amountVnd;
  else if(r.state==="REVERSAL_CONFIRMED")netReceivedVnd-=r.amountVnd;
  if(!Number.isSafeInteger(netReceivedVnd))throw Error("RECEIPT_OVERFLOW");
 }
 if(netReceivedVnd<0)throw Error("REVERSAL_EXCEEDS_RECEIPTS");
 return {
  netReceivedVnd,
  balanceVnd:officialTotalVnd===null?null:officialTotalVnd-netReceivedVnd,
  status:officialTotalVnd===null?"TOTAL_PENDING":netReceivedVnd===0?"UNPAID":
   netReceivedVnd<officialTotalVnd?"PARTIAL":netReceivedVnd===officialTotalVnd?"PAID":"OVERPAID"
 };
}
export function stockAvailability(item){
 if(item?.openingConfirmed!==true||!Number.isSafeInteger(item.onHand)||!Number.isSafeInteger(item.held))
  return {state:"UNKNOWN",available:null};
 const available=item.onHand-item.held;
 if(!Number.isSafeInteger(available)||available<0)return {state:"RECONCILE",available:null};
 return {state:available===0?"OUT":"KNOWN",available};
}
export function vnd(value){return value===null||value===undefined?"Chưa xác định":new Intl.NumberFormat("vi-VN",{style:"currency",currency:"VND",maximumFractionDigits:0}).format(value)}
export function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
