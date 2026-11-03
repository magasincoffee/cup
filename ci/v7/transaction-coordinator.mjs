// V7 transactional coordinator — host-neutral protocol. NO Google Sheets writes.
// A production adapter MUST implement durable storage, exclusive lock, and
// idempotent atomic effects/reconciliation before this can be deployed.
const fail=code=>{throw new Error(code)};
const valid=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{7,119}$/.test(x);
const states=new Set(['PREPARED','COMMITTED','NEEDS_RECONCILIATION']);
const text=x=>JSON.stringify(x);
const assertIntent=intent=>{
 if(!intent||!valid(intent.requestKey)||!valid(intent.orderId)||
  !['ORDER_COMMIT_INTENT_V1','RECEIPT_INTENT_V1'].includes(intent.type))
  fail('INTENT_INVALID');
 // Intent must have already passed server-side validation; browser-supplied
 // intents are never trusted. Caller owns authorization and price approval.
};
export function createTransactionCoordinator({authorize,lock,store,applyEffect}){
 if(typeof authorize!=='function'||typeof lock?.runExclusive!=='function'||
  typeof store?.get!=='function'||typeof store?.prepare!=='function'||
  typeof store?.finish!=='function'||typeof applyEffect!=='function')
  fail('ADAPTER_INCOMPLETE');
 async function execute({actor,intent}){
  assertIntent(intent);
  // No persistence or lookup before authorization.
  await authorize(actor,intent);
  return lock.runExclusive(async()=>{
   // Re-evaluate authorization inside the lock: caller could have changed roles.
   await authorize(actor,intent);
   const fingerprint=text(intent);
   const existing=await store.get(intent.requestKey);
   if(existing){
    if(existing.fingerprint!==fingerprint)fail('IDEMPOTENCY_CONFLICT');
    if(existing.state==='COMMITTED')return Object.freeze({status:'COMMITTED',replayed:true,requestKey:intent.requestKey});
    if(!states.has(existing.state))fail('JOURNAL_CORRUPT');
    fail('NEEDS_RECONCILIATION');
   }
   // Durable PREPARED must finish before the first effect; adapter must
   // guarantee uniqueness of requestKey and atomic PREPARED persistence.
   await store.prepare({requestKey:intent.requestKey,orderId:intent.orderId,
    type:intent.type,fingerprint,state:'PREPARED'});
   try{
    // This callback is trusted code, never a generic client mutation route.
    // It must use transactional / independently idempotent effects.
    await applyEffect(intent);
   }catch{
    try{await store.finish(intent.requestKey,'NEEDS_RECONCILIATION')}catch{}
    fail('NEEDS_RECONCILIATION');
   }
   // If the commit marker fails, the effect may already exist. Do not retry.
   try{await store.finish(intent.requestKey,'COMMITTED')}
   catch{fail('NEEDS_RECONCILIATION')}
   return Object.freeze({status:'COMMITTED',replayed:false,requestKey:intent.requestKey});
  });
 }
 return Object.freeze({execute});
}
