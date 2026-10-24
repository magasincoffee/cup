/**
 * T015 synthetic FAULT MATRIX only, not a production inventory engine.
 * Never contacts Google, writes to a real spreadsheet, or reads OAuth.
 * Encodes expected conservative invariants for future Apps Script live fault QA.
 */
export class UnresolvedStockRequest extends Error {
  constructor(code){super(code);this.name='UnresolvedStockRequest';}
}
const clone=x=>structuredClone(x);
const assert=(ok,code)=>{if(!ok)throw new UnresolvedStockRequest(code)};
const safeInt=(n,nonzero=false)=>Number.isSafeInteger(n)&&n>=(nonzero?1:0);

export class FaultLab {
  constructor({opening=10,owner=true,writes=false,leaseExpiresAt=0,now=100}={}){
    this.opening=opening;
    this.owner=owner;this.writes=writes;this.leaseExpiresAt=leaseExpiresAt;this.now=now;
    this.journal=new Map();this.movements=new Map();this.reservations=new Map();
    this.audit=new Map();this.finished=0;
  }
  balance(){
    const total=this.opening+[...this.movements.values()].reduce((a,m)=>a+
      (m.kind==='RECEIPT'?m.qty:-m.qty),0);
    const held=[...this.reservations.values()].filter(r=>r.state==='ACTIVE')
       .reduce((a,r)=>a+r.qty-r.released,0);
    const invalid=(!safeInt(total)||!safeInt(held)||!safeInt(total-held));
    return {total:invalid?null:total,held:invalid?null:held,
      available:invalid?null:total-held,quarantined:this.unresolved().length>0||invalid};
  }
  unresolved(){return [...this.journal.values()].filter(x=>!['COMMITTED','OWNER_ABORTED'].includes(x.state));}
  read(){
    const b=this.balance();return b.quarantined?{...b,total:null,held:null,available:null}:b;
  }
  fingerprint(){return JSON.stringify({movements:[...this.movements],reservations:[...this.reservations],audit:[...this.audit]});}
  _auth(){
    assert(this.owner,'OWNER_DENIED');
    assert(this.writes&&this.now<this.leaseExpiresAt,'WRITE_LEASE_CLOSED');
    assert(this.unresolved().length===0,'STOCK_QUARANTINED');
  }
  _expected(type,qty,resId){
    assert(['RECEIPT','RESERVE','ISSUE','RELEASE'].includes(type),'TYPE_DENIED');
    assert(safeInt(qty,true),'INVALID_QTY');
    const b=this.balance();assert(!b.quarantined,'INVALID_STOCK');
    const reservation=resId?this.reservations.get(resId):null;
    if(type==='RESERVE')assert(qty<=b.available,'OVER_RESERVE');
    if(type==='ISSUE'||type==='RELEASE'){
      assert(reservation&&reservation.state==='ACTIVE','MISSING_ACTIVE_HOLD');
      assert(qty<=reservation.qty-reservation.released,'OVER_CONSUME_HOLD');
    }
    return {b,reservation};
  }
  execute({requestId,payloadHash,type,qty,resId=null,inject=null}){
    assert(typeof requestId==='string'&&requestId.length>0,'NO_REQUEST_ID');
    assert(typeof payloadHash==='string'&&payloadHash.length>0,'NO_PAYLOAD_HASH');
    // Replay must be read-only, even when writes are closed; identity must match.
    const past=this.journal.get(requestId);
    if(past){
      assert(past.payloadHash===payloadHash,'IDEMPOTENCY_PAYLOAD_CONFLICT');
      assert(past.state==='COMMITTED','UNRESOLVED_REPLAY_DENIED');
      return {replay:true,requestId,proof:clone(past.after)};
    }
    this._auth();
    const {b}=this._expected(type,qty,resId);
    const before={balance:b,transactions:this.movements.size,holds:this.reservations.size};
    const after={total:b.total+(type==='RECEIPT'?qty:type==='ISSUE'?-qty:0),
      held:b.held+(type==='RESERVE'?qty:['ISSUE','RELEASE'].includes(type)?-qty:0)};
    after.available=after.total-after.held;
    assert(safeInt(after.total)&&safeInt(after.held)&&safeInt(after.available),'NEGATIVE_FINAL_BALANCE');
    const j={requestId,payloadHash,type,qty,resId,state:'PREPARED',before:clone(before),
      expectedAfter:clone(after),after:null};
    this.journal.set(requestId,j);
    if(inject==='afterPrepare')throw new UnresolvedStockRequest('FAULT_AFTER_PREPARE');
    if(type==='RECEIPT'||type==='ISSUE'){
      this.movements.set(requestId,{requestId,kind:type,qty,resId});
    }else if(type==='RESERVE'){
      this.reservations.set(requestId,{requestId,qty,released:0,state:'ACTIVE'});
    }else{
      const r=this.reservations.get(resId);
      r.released+=qty;if(r.released===r.qty)r.state='RELEASED';
    }
    if(type==='ISSUE'){
      const r=this.reservations.get(resId);
      r.released+=qty;if(r.released===r.qty)r.state='RELEASED';
    }
    if(inject==='afterBusinessWrite')throw new UnresolvedStockRequest('FAULT_AFTER_BUSINESS_WRITE');
    this.audit.set(requestId,{requestId,event:'COMMITTED',payloadHash});
    if(inject==='afterAudit')throw new UnresolvedStockRequest('FAULT_AFTER_AUDIT');
    const live=this.balance();
    assert(!live.quarantined||this.unresolved().length===1,'UNEXPECTED_QUARANTINE');
    // Do not clear journal until commit markers are durable.
    assert(live.total===after.total&&live.held===after.held,'AFTER_IMAGE_MISMATCH');
    j.after=clone(after);j.state='COMMITTED';this.finished++;
    return {replay:false,requestId,proof:clone(after)};
  }
  classify(requestId){
    const j=this.journal.get(requestId);assert(j,'REQUEST_UNKNOWN');
    if(j.state==='COMMITTED')return 'ALREADY_COMMITTED';
    const hasAudit=this.audit.has(requestId);
    const b=this.balance();
    const fp={total:b.total,held:b.held,available:b.available};
    const matchesAfter=Object.keys(fp).every(k=>fp[k]===j.expectedAfter[k]);
    const matchesBefore=Object.keys(fp).every(k=>fp[k]===j.before.balance[k]);
    const sideEffects=this.movements.has(requestId)||this.reservations.has(requestId)||
      (j.resId&&this.reservations.get(j.resId)?.released>0);
    if(matchesBefore&&!sideEffects&&!hasAudit)return 'NO_EFFECTS_OWNER_REVIEW';
    if(matchesAfter&&hasAudit)return 'COMPLETE_AFTER_OWNER_VERIFY';
    return 'PARTIAL_OR_AMBIGUOUS_OWNER_REVIEW';
  }
  recover(requestId,{ownerApproved=false}={}){
    const kind=this.classify(requestId);
    if(kind==='ALREADY_COMMITTED')return kind;
    if(kind==='COMPLETE_AFTER_OWNER_VERIFY'&&ownerApproved){
      const j=this.journal.get(requestId);const b=this.balance();
      j.state='COMMITTED';j.after={total:b.total,held:b.held,available:b.available};this.finished++;
      return 'COMMITTED_AFTER_OWNER_APPROVAL';
    }
    // No live stock mutation or auto replay for partial/ambiguous failure.
    return kind;
  }
}
