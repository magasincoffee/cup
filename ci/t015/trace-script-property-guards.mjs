/**
 * Focused READ-ONLY inspection of Script Properties call sites in Apps Script QA.
 * Never evaluates source code or property values; outputs aggregate counters only.
 * Numeric conversion alone never establishes fail-closed lease handling.
 */
import {parse} from 'acorn';
const KEYS=['T015_OWNER_EMAIL','T015_WRITES_ENABLED','T015_WRITE_LEASE_UNTIL'];
const FN_TYPES=new Set(['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression']);
function walk(node,visitor,skipNested=false,root=true){
 if(!node||typeof node!=='object')return;
 if(typeof node.type==='string'){
  if(skipNested&&!root&&FN_TYPES.has(node.type))return;
  visitor(node);
 }
 for(const [key,v] of Object.entries(node)){
  if(['start','end','loc'].includes(key))continue;
  if(Array.isArray(v)){for(const sub of v)walk(sub,visitor,skipNested,false)}
  else if(v&&typeof v==='object')walk(v,visitor,skipNested,false);
 }
}
function name(node){
 if(!node)return '';
 if(node.type==='Identifier')return node.name;
 if(node.type==='MemberExpression')return node.computed?
  (node.property?.type==='Literal'?String(node.property.value):''):
  (node.property?.name||'');
 return '';
}
function keyOf(node,aliases){
 if(node?.type==='Literal'&&typeof node.value==='string'&&KEYS.includes(node.value))return node.value;
 if(node?.type==='Identifier'&&aliases.has(node.name))return aliases.get(node.name);
 return null;
}
export function inspectScriptPropertyGuards(source){
 const out={
  decision:'MANUAL_GUARD_SOURCE_REVIEW_REQUIRED',
  filesInspected:0,ownerKeyReadSites:0,writeEnabledKeyReadSites:0,
  leaseKeyReadSites:0,leaseReferencingFunctions:0,
  leaseNumericConversionCandidateFunctions:0,
  leaseDateConversionCandidateFunctions:0,
  leaseFiniteValidationCandidateFunctions:0,
  leaseConditionalCandidateFunctions:0,
  propertyReadSitesWithDynamicKey:0,
  leaseTextValueFailClosedVerified:false,
  ownerMatchVerified:false,
  actualScriptPropertiesRead:false,
  runtimeRecoveryVerified:false
 };
 const reads={'T015_OWNER_EMAIL':'ownerKeyReadSites',
 'T015_WRITES_ENABLED':'writeEnabledKeyReadSites',
 'T015_WRITE_LEASE_UNTIL':'leaseKeyReadSites'};
 for(const code of Object.values(source)){
  if(typeof code!=='string')throw Error('SOURCE_EXPECTED');
  out.filesInspected++;
  const ast=parse(code,{ecmaVersion:'latest',sourceType:'script',allowReturnOutsideFunction:true});
  const aliases=new Map();
  walk(ast,n=>{
   if(n.type==='VariableDeclarator'&&n.id?.type==='Identifier'&&n.init?.type==='Literal'&&
    KEYS.includes(n.init.value))aliases.set(n.id.name,n.init.value);
  });
  // Only top-level or named function nodes are scored, not overlapping nested
  // bodies, to avoid double-counting one property lookup as multiple guards.
  const funcs=[];
  walk(ast,n=>{if(FN_TYPES.has(n.type))funcs.push(n)});
  for(const fn of funcs){
   const found=new Set(),callNames=new Set();
   let numeric=false,date=false,finite=false,conditional=false;
   walk(fn.body??fn,n=>{
    if(n.type==='CallExpression'){
     const call=name(n.callee);
     callNames.add(call);
     if(call==='getProperty'){
      const key=keyOf(n.arguments?.[0],aliases);
      if(key){out[reads[key]]++;found.add(key)}
      else out.propertyReadSitesWithDynamicKey++;
     }
     if(['Number','parseInt','parseFloat'].includes(call))numeric=true;
     if(call==='parse')date=true;  // Date.parse candidate, not proof of parsing.
     if(['isFinite','isNaN'].includes(call))finite=true;
    }
    if(n.type==='NewExpression'&&name(n.callee)==='Date')date=true;
    if(['IfStatement','ConditionalExpression','LogicalExpression'].includes(n.type))
      conditional=true;
   },true);
   if(found.has('T015_WRITE_LEASE_UNTIL')){
    out.leaseReferencingFunctions++;
    if(numeric)out.leaseNumericConversionCandidateFunctions++;
    if(date)out.leaseDateConversionCandidateFunctions++;
    if(finite)out.leaseFiniteValidationCandidateFunctions++;
    if(conditional)out.leaseConditionalCandidateFunctions++;
   }
  }
 }
 return out;
}
