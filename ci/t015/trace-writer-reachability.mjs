/**
 * Read-only static call-site triage. Never fetches credentials or runs Apps Script.
 * Counts only. Reachability is not proof of lock acquisition, authorization,
 * transaction ordering or crash recovery.
 */
import {parse} from 'acorn';
const MUTATORS=new Set(['appendRow','setValue','setValues','setProperty','setProperties',
 'deleteRow','deleteRows','insertRowBefore','insertRowsAfter','clear','clearContent','copyTo']);
const isFunction=n=>n&&['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(n.type);
const calleeName=n=>n?.type==='Identifier'?n.name:n?.type==='MemberExpression'?
  (n.computed?(n.property?.type==='Literal'?String(n.property.value):''):n.property?.name)||'':'';
function walk(root,visit,{skipNested=false}={}){
 function go(node,isRoot){
  if(!node||typeof node!=='object')return;
  if(typeof node.type==='string'){
   if(skipNested&&isFunction(node)&&!isRoot)return;
   visit(node);
  }
  for(const [k,v] of Object.entries(node)){
   if(['start','end','loc'].includes(k))continue;
   if(Array.isArray(v))for(const item of v)go(item,false);
   else if(v&&typeof v==='object')go(v,false);
  }
 }
 go(root,true);
}
export function inspectWriterReachability(source){
 const entries=[];
 for(const [file,code] of Object.entries(source)){
  if(typeof code!=='string')throw Error('SOURCE_MISSING');
  const ast=parse(code,{ecmaVersion:'latest',sourceType:'script',allowReturnOutsideFunction:true});
  // The same node may be encountered as both a declaration and an expression:
  // deduplicate by AST identity.
  const discovered=new Map();
  walk(ast,n=>{
   if(n.type==='FunctionDeclaration'&&n.id?.name)discovered.set(n,n.id.name);
   if(n.type==='VariableDeclarator'&&n.id?.type==='Identifier'&&isFunction(n.init))
     discovered.set(n.init,n.id.name);
   if(n.type==='AssignmentExpression'&&n.left?.type==='Identifier'&&isFunction(n.right))
     discovered.set(n.right,n.left.name);
  });
  // Also count unnamed nested functions as writers. Their callers cannot be
  // resolved statically, so they remain manual-review candidates.
  walk(ast,n=>{if(isFunction(n)&&!discovered.has(n))discovered.set(n,null)});
  for(const [fn,name] of discovered){
   const calls=[],symbols=[];
   let writes=false,lock=false,owner=false,lease=false;
   walk(fn.body??fn,n=>{
     if(n.type==='Identifier'&&n.name==='LockService')lock=true;
     if(n.type==='Literal'&&typeof n.value==='string')symbols.push(n.value);
     // Guards often refer to a named constant rather than repeating its string key.
     if(n.type==='Identifier')symbols.push(n.name);
     if(n.type==='TemplateElement'&&typeof n.value?.cooked==='string')symbols.push(n.value.cooked);
     if(n.type==='CallExpression'){
       const call=calleeName(n.callee);
       if(MUTATORS.has(call))writes=true;
       if(n.callee.type==='Identifier')calls.push(call);
     }
   },{skipNested:true});
   owner=symbols.some(s=>s.includes('T015_OWNER_EMAIL'));
   lease=symbols.some(s=>s.includes('T015_WRITES_ENABLED')||s.includes('T015_WRITE_LEASE_UNTIL'));
   entries.push({name,file,calls,writes,lock,owner,lease});
  }
 }
 const named=new Map();
 entries.forEach((e,i)=>{if(e.name){if(!named.has(e.name))named.set(e.name,[]);named.get(e.name).push(i)}});
 const ambiguous=new Set([...named].filter(([,ids])=>ids.length!==1).map(([name])=>name));
 const edges=entries.map(e=>new Set(e.calls.flatMap(name=>
   ambiguous.has(name)?[]:named.get(name)??[])));
 const parents=entries.map(()=>new Set());
 edges.forEach((childSet,parent)=>{for(const child of childSet)parents[child].add(parent)});
 const ancestors=start=>{
   const seen=new Set([start]),todo=[start];
   for(const current of todo)for(const caller of parents[current]){
     if(!seen.has(caller)){seen.add(caller);todo.push(caller)}
   }
   return [...seen].map(i=>entries[i]);
 };
 // Calling a guard helper is separate from being called by a guarded wrapper.
 // These are only references; neither direction proves control-flow dominance.
 const descendants=start=>{
   const seen=new Set([start]),todo=[start];
   for(const current of todo)for(const callee of edges[current]){
     if(!seen.has(callee)){seen.add(callee);todo.push(callee)}
   }
   return [...seen].filter(i=>i!==start).map(i=>entries[i]);
 };
 const writers=entries.flatMap((e,i)=>e.writes?[i]:[]);
 let noLock=0,noOwner=0,noLease=0,bothRefs=0,unnamed=0;
 let directLock=0,directOwner=0,directLease=0;
 let downstreamLock=0,downstreamOwner=0,downstreamLease=0;
 let downstreamAllThree=0;
 for(const i of writers){
   const a=ancestors(i),d=descendants(i),self=entries[i];
   const lock=a.some(x=>x.lock),owner=a.some(x=>x.owner),lease=a.some(x=>x.lease);
   if(self.lock)directLock++;
   if(self.owner)directOwner++;
   if(self.lease)directLease++;
   if(d.some(x=>x.lock))downstreamLock++;
   if(d.some(x=>x.owner))downstreamOwner++;
   if(d.some(x=>x.lease))downstreamLease++;
   if(d.some(x=>x.lock)&&d.some(x=>x.owner)&&d.some(x=>x.lease))downstreamAllThree++;
   if(!lock)noLock++;
   if(!owner)noOwner++;
   if(!lease)noLease++;
   if(lock&&owner&&lease)bothRefs++;
   if(!entries[i].name)unnamed++;
 }
 const unresolvedCalls=entries.reduce((n,e)=>n+e.calls.filter(call=>ambiguous.has(call)).length,0);
 return {
   inspectedFunctions:entries.length,writerFunctions:writers.length,
   writersWithoutStaticLockCaller:noLock,
   writersWithoutStaticOwnerMarkerCaller:noOwner,
   writersWithoutStaticLeaseMarkerCaller:noLease,
   writersReachableFromAllThreeMarkerTypes:bothRefs,
   writersWithDirectLockReference:directLock,
   writersWithDirectOwnerKeyReference:directOwner,
   writersWithDirectLeaseKeyReference:directLease,
   writersCallingLockReferenceHelper:downstreamLock,
   writersCallingOwnerKeyReferenceHelper:downstreamOwner,
   writersCallingLeaseKeyReferenceHelper:downstreamLease,
   writersCallingHelpersCoveringThreeMarkerTypes:downstreamAllThree,
   unnamedWriterFunctions:unnamed,
   ambiguousFunctionNames:ambiguous.size,ambiguousDirectCallSites:unresolvedCalls,
   decision:'STATIC_CALL_GRAPH_TRIAGE_ONLY',
   scriptPropertiesVerified:false,runtimeRecoveryVerified:false
 };
}
