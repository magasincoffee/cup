/**
 * MAGASIN CUP V7 — explicitly invoked Owner QA diagnostic, read-only.
 * NEVER logs rows, names, contact details, project IDs or credentials.
 * Never run as an unattended scheduled trigger or expose in a public Web App.
 */
function v7OwnerQaSelfCheck(){
 var response=v7OwnerReadSnapshot({
  schema:'magasin-cup.v7.read.v1',
  operation:'READ_SNAPSHOT_V1'
 });
 if(!response||response.ok!==true){
  var status=response&&['AUTH_REQUIRED','FORBIDDEN'].includes(response.error)?
   response.error:'READ_FAILED';
  Logger.log('V7_OWNER_QA_READ_STATUS='+status);
  return {status:status,readOnly:true};
 }
 var data=response.envelope&&response.envelope.payload;
 if(!data||!Array.isArray(data.products)||!Array.isArray(data.orders)||
    !Array.isArray(data.customers)){
  Logger.log('V7_OWNER_QA_READ_STATUS=READ_FAILED');
  return {status:'READ_FAILED',readOnly:true};
 }
 var stats={
  status:'READ_ONLY_QA_SNAPSHOT_OK',
  schema:response.envelope.schema,
  readOnly:true,
  productCount:data.products.length,
  unknownStockCount:data.products.filter(function(x){return x.openingConfirmed!==true}).length,
  orderCount:data.orders.length,
  customerProfileCount:data.customers.length,
  approvedPriceCount:data.products.filter(function(x){return x.priceApprovalState==='APPROVED'}).length,
  reviewRequiredPriceCount:data.products.filter(function(x){return x.priceApprovalState!=='APPROVED'}).length
 };
 Logger.log('V7_OWNER_QA_READ_COUNTS='+JSON.stringify(stats));
 return stats;
}
