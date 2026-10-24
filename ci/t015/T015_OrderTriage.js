'use strict';
/** T015 Owner-only QA read-only order triage. Requires T015_Projection.js. */
const T15_ORDER_TRIAGE = Object.freeze({
  version: 'T015-ORDER-TRIAGE-QA-CANDIDATE-1',
  actionable: 'ACTIONABLE_STATE_SYNC',
  unknown: 'WAITING_OPENING_COUNT',
  draft: 'DRAFT_NO_STOCK_ACTION',
  manual: 'MANUAL_RECONCILIATION',
  match: 'MATCH',
});
function t15ClassifyOrder_(order) {
  if (!order || typeof order !== 'object' || !Array.isArray(order.lines) ||
      typeof order.orderId !== 'string' || !order.orderId) throw Error('T015_TRIAGE_INVALID_ORDER');
  const states = order.lines.map(line => {
    if (!line || typeof line !== 'object') throw Error('T015_TRIAGE_INVALID_LINE');
    return line.status;
  });
  let triage, reason;
  if (order.commercialState === 'DRAFT') {
    triage = T15_ORDER_TRIAGE.draft;
    reason = 'Draft orders require no stock action';
  } else if (!order.lines.length || states.some(x => x === 'NEEDS_REVIEW') ||
    order.lines.some(x => x.stockStatus === 'QUARANTINED') ||
    order.projectedInventoryState === 'NEEDS_REVIEW') {
    triage = T15_ORDER_TRIAGE.manual;
    reason = 'Warehouse facts require reconciliation';
  } else if (states.some(x => x === 'STOCK_UNKNOWN') ||
    order.lines.some(x => x.stockStatus === 'UNKNOWN') ||
    order.projectedInventoryState === 'STOCK_UNKNOWN') {
    triage = T15_ORDER_TRIAGE.unknown;
    reason = 'Opening balance is unconfirmed';
  } else if (order.disagreesWithStored === true) {
    triage = T15_ORDER_TRIAGE.actionable;
    reason = 'Verified stock state differs from stored order cache';
  } else {
    triage = T15_ORDER_TRIAGE.match;
    reason = 'Stored and derived states agree';
  }
  return {orderId:order.orderId,triage,reason,
    requiresOrderStateReview:triage===T15_ORDER_TRIAGE.actionable,
    projectedInventoryState:order.projectedInventoryState||null,
    persistedInventoryState:order.persistedInventoryState||null,
    details:order.lines.map(line=>({
      lineId:String(line.lineId||''),sku:String(line.sku||''),status:line.status,
      quantity:line.quantity,issued:line.issued,held:line.held,remainingToIssue:line.remainingToIssue,
    }))};
}
function t15ViewTriage_(projection) {
  if (!projection || !Array.isArray(projection.orders)) throw Error('T015_TRIAGE_INVALID_PROJECTION');
  const seen=new Set();
  const orders=projection.orders.map(order=>{
    if(seen.has(order.orderId))throw Error('T015_TRIAGE_DUPLICATE_ORDER');
    seen.add(order.orderId);
    return t15ClassifyOrder_(order);
  });
  const counts={actionable:0,openingUnconfirmed:0,draft:0,requiresManualReconciliation:0,
    matching:0,total:orders.length};
  for(const order of orders) {
    switch(order.triage) {
      case T15_ORDER_TRIAGE.actionable:counts.actionable++;break;
      case T15_ORDER_TRIAGE.unknown:counts.openingUnconfirmed++;break;
      case T15_ORDER_TRIAGE.draft:counts.draft++;break;
      case T15_ORDER_TRIAGE.manual:counts.requiresManualReconciliation++;break;
      case T15_ORDER_TRIAGE.match:counts.matching++;break;
      default:throw Error('T015_TRIAGE_UNKNOWN_CATEGORY');
    }
  }
  if(counts.total!==counts.actionable+counts.openingUnconfirmed+counts.draft+
      counts.requiresManualReconciliation+counts.matching)throw Error('T015_TRIAGE_COUNT_MISMATCH');
  return {environment:'T015_OWNER_ONLY_STOCK_PROJECTION_QA',version:T15_ORDER_TRIAGE.version,
    readOnly:true,sourceVersion:projection.version||null,
    writeGateWarning:projection.writeGateOpen===true?'WRITE_GATE_OPEN':null,counts,orders};
}
function v7T015OrderTriageQA() {
  t12Owner_(false);
  return t15ViewTriage_(v7T015StockOrderProjection());
}
