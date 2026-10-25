/**
 * Read-only semantic topology from already pulled private Apps Script source.
 * Reports only aggregate code-shape counts, never source, function names,
 * property values, auth, spreadsheet rows or dynamic execution results.
 */
import fs from 'node:fs';
import path from 'node:path';
import {parse} from 'acorn';
const STOCK_FILES=['T015_Core.js','T015_Lab.js','T015_Projection.js',
 'T015_OrderTriage.js','InventoryT015.js','InventoryT015.allocations.js',
 'InventoryT015.fulfillment.js','InventoryT015.safe.js',
 'InventoryT015.safe-extra.js'];
const markerTokens=['PREPARED','COMMITTED','NEEDS_RECONCILIATION',
 'V7_IDEMPOTENCY','V7_AUDIT_EVENTS','T015_WRITES_ENABLED',
 'T015_WRITE_LEASE_UNTIL','T015_OWNER_EMAIL'];
const mutationCalls=new Set(['appendRow','setValue','setValues','setProperty',
 'setProperties','deleteRow','deleteRows','insertRowBefore','insertRowsAfter',
 'clear','clearContent','copyTo']);
const property=(callee)=>{
 if(!callee)return '';
 if(callee.type==='Identifier')return callee.name;
 if(callee.type==='MemberExpression')
   return callee.computed?String(callee.property.value??''):String(callee.property.name??'');
 return '';
};
function traverse(root,visitor,{skipFunctions=false}={}){
 function inner(n,isRoot){
  if(!n||typeof n!=='object')return;
  if(typeof n.type==='string'){
   const isFn=/^(FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/.test(n.type);
   if(skipFunctions&&isFn&&!isRoot)return;
   visitor(n);
  }
  for(const [key,v] of Object.entries(n)){
   if(['start','end','loc'].includes(key))continue;
   if(Array.isArray(v))for(const it of v)inner(it,false);
   else if(v&&typeof v==='object')inner(v,false);
  }
 }
 inner(root,true);
}
export function inspectSource(map){
 const report={modules:[],totalFunctions:0,writerFunctions:0,
  sameFunctionTransactionSequence:0,ambiguousWriterFunctions:0,
  markers:Object.fromEntries(markerTokens.map(k=>[k,false])),
  lockReferences:0,scriptPropertyReferences:0,
  decision:'STATIC_TOPOLOGY_ONLY',runtimeRecoveryVerified:false,
  scriptPropertiesVerified:false};
 for(const file of STOCK_FILES){
  if(typeof map[file]!=='string')throw Error('T015_SOURCE_TRACE_MISSING_FILE');
  const ast=parse(map[file],{ecmaVersion:'latest',sourceType:'script',
    allowReturnOutsideFunction:true});
  // Include top-level state constants as well as function-scoped literals.
  traverse(ast,n=>{
    const value=n.type==='Literal'?n.value:n.type==='Identifier'?n.name:null;
    if(typeof value==='string')for(const key of markerTokens)
      if(value.includes(key))report.markers[key]=true;
  });
  const moduleResult={file,functions:0,mutators:0,lockReferences:0,
   idempotencyMarkers:0,manualSequenceReview:0};
  let functions=[];
  traverse(ast,n=>{
   if(['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(n.type))
      functions.push(n);
  });
  for(const fn of functions){
   moduleResult.functions++;report.totalFunctions++;
   const literals=[];
   const events=[];
   let writes=0;
   traverse(fn.body??fn,n=>{
    if(n.type==='Literal'&&typeof n.value==='string')literals.push({v:n.value,pos:n.start});
    if(n.type==='TemplateElement')literals.push({v:n.value?.cooked??'',pos:n.start});
    if(n.type==='Identifier'&&n.name==='LockService'){
      moduleResult.lockReferences++;report.lockReferences++;
    }
    if(n.type==='Identifier'&&n.name==='PropertiesService')report.scriptPropertyReferences++;
    if(n.type==='CallExpression'){
      const p=property(n.callee);
      if(mutationCalls.has(p)){writes++;events.push({event:'WRITE',pos:n.start})}
    }
   },{skipFunctions:true});
   for(const lit of literals){
    for(const key of markerTokens)
      if(lit.v.includes(key)){
       report.markers[key]=true;
       if(key==='V7_IDEMPOTENCY')moduleResult.idempotencyMarkers++;
       if(['PREPARED','COMMITTED','V7_AUDIT_EVENTS'].includes(key))
        events.push({event:key,pos:lit.pos});
      }
   }
   if(writes){
    report.writerFunctions++;moduleResult.mutators++;
    const trace=events.sort((a,b)=>a.pos-b.pos).map(x=>x.event);
    const prep=trace.indexOf('PREPARED');
    const write=trace.indexOf('WRITE');
    const commit=trace.lastIndexOf('COMMITTED');
    if(prep>=0&&write>prep&&commit>write)
      report.sameFunctionTransactionSequence++;
    else {
      report.ambiguousWriterFunctions++;moduleResult.manualSequenceReview++;
    }
   }
  }
  report.modules.push(moduleResult);
 }
 const mustExist=['PREPARED','COMMITTED','V7_IDEMPOTENCY','V7_AUDIT_EVENTS',
  'T015_WRITES_ENABLED','T015_WRITE_LEASE_UNTIL','T015_OWNER_EMAIL'];
 report.missingRequired=mustExist.filter(key=>!report.markers[key]);
 if(report.missingRequired.length)report.decision='BLOCK_STATIC_GUARD_MARKERS_MISSING';
 return report;
}
function outputOnlySafeCounts(r){
 return {
  decision:r.decision,modules:r.modules,functions:r.totalFunctions,
  mutationFunctions:r.writerFunctions,
  directlyOrderedWriters:r.sameFunctionTransactionSequence,
  requiresManualCallPathReview:r.ambiguousWriterFunctions,
  requiredMarkersPresent:r.missingRequired.length===0,
  lockReferences:r.lockReferences,scriptPropertyReferences:r.scriptPropertyReferences,
  scriptPropertiesVerified:false,runtimeRecoveryVerified:false
 };
}
if(process.argv[1]&&path.resolve(process.argv[1])===new URL(import.meta.url).pathname){
 const dir=process.argv[2];
 if(!dir)throw Error('T015_SOURCE_TRACE_NEEDS_DIR');
 const source={};
 for(const file of STOCK_FILES)source[file]=fs.readFileSync(path.join(dir,file),'utf8');
 const result=inspectSource(source);
 console.log('T015_SOURCE_TOPOLOGY '+JSON.stringify(outputOnlySafeCounts(result)));
 console.log('NOTE no Script Properties access; heuristic direct-scope ordering is NOT call-graph proof');
 if(result.decision!=='STATIC_TOPOLOGY_ONLY')process.exitCode=1;
}
