import fs from 'node:fs';
import path from 'node:path';
const ORIGINAL_BOOK='1tot2RNXprYLkoOVXDi5j3yyavHyxI_ayR78KdP1Wzuo';
const FAULT_BOOK='1nfJwdzTA99V9WSL6fdCLpMHCnYHqnUJXp505vOjYAsI';
export const EXPECTED_FILES=['T015_Core.js','T015_Health.js','T015_Lab.js','T015_ReadOnly.html',
'T015_Projection.js','T015_OrderTriage.js','InventoryT015.js',
'InventoryT015.allocations.js','InventoryT015.fulfillment.js',
'InventoryT015.safe.js','InventoryT015.safe-extra.js','appsscript.json'].sort();
const gate=(yes,code)=>{if(!yes)throw Error('T015_DISPOSABLE_GATE_'+code)};
export function prepareFaultCopy(source,target){
  gate(fs.existsSync(source)&&fs.existsSync(target),'DIRECTORY_MISSING');
  const files=fs.readdirSync(source).filter(x=>/\.(?:js|html|json)$/.test(x)&&x!=='.clasp.json').sort();
  gate(JSON.stringify(files)===JSON.stringify(EXPECTED_FILES),'IMMUTABLE_V4_FILESET_DRIFT');
  gate(fs.readdirSync(target).every(x=>x==='.clasp.json'),'TARGET_NOT_EMPTY');
  const manifest=JSON.parse(fs.readFileSync(path.join(source,'appsscript.json'),'utf8'));
  gate(manifest.webapp?.access==='MYSELF'&&manifest.webapp?.executeAs==='USER_DEPLOYING','NOT_OWNER_ONLY');
  const core=fs.readFileSync(path.join(source,'T015_Core.js'),'utf8');
  gate(core.includes('T015_WRITES_ENABLED')&&core.includes('T015_WRITE_LEASE_UNTIL'),'MISSING_WRITE_GUARDS');
  gate(core.includes(ORIGINAL_BOOK),'SOURCE_NOT_OLD_QA_BOOK');
  let patchedIds=0;
  for(const file of files){
    const original=fs.readFileSync(path.join(source,file),'utf8');
    let changed=original;
    if(file!=='appsscript.json'){
      const occurrences=original.split(ORIGINAL_BOOK).length-1;
      patchedIds+=occurrences;
      changed=original.split(ORIGINAL_BOOK).join(FAULT_BOOK);
    }
    if(file==='T015_Lab.js'){
      const match=/function\s+v7T015LabRunOnce\s*\([^)]*\)\s*\{/g;
      const matches=[...changed.matchAll(match)];
      gate(matches.length===1,'ONE_SHOT_ENTRYPOINT_UNEXPECTED');
      changed=changed.replace(match,part=>part+"\n throw Error('T015_DISPOSABLE_ONE_SHOT_DISABLED');\n");
    }
    gate(!changed.includes(ORIGINAL_BOOK),'OLD_QA_BOOK_NOT_REPLACED');
    fs.writeFileSync(path.join(target,file),changed,{mode:0o600,flag:'wx'});
  }
  gate(patchedIds>0,'BOOK_MAPPING_NOT_CHANGED');
  const targetFiles=fs.readdirSync(target).filter(x=>/\.(?:js|html|json)$/.test(x)).sort();
  gate(JSON.stringify(targetFiles)===JSON.stringify(EXPECTED_FILES),'UNEXPECTED_TARGET_FILESET');
  const merged=targetFiles.map(f=>fs.readFileSync(path.join(target,f),'utf8')).join('\n');
  gate(!merged.includes(ORIGINAL_BOOK)&&merged.includes(FAULT_BOOK),'ORIGINAL_BOOK_REFERENCED');
  gate(fs.readFileSync(path.join(target,'T015_Lab.js'),'utf8').includes('T015_DISPOSABLE_ONE_SHOT_DISABLED'),'LAB_NOT_FROZEN');
  const tCore=fs.readFileSync(path.join(target,'T015_Core.js'),'utf8');
  gate(tCore.includes(FAULT_BOOK),'NEW_WORKBOOK_NOT_IN_CORE');
  gate(!tCore.includes(ORIGINAL_BOOK),'OLD_WORKBOOK_STILL_IN_CORE');
  return {files:targetFiles.length,workbookId:FAULT_BOOK,oneShotDisabled:true,
    projectIdNotYetCreated:true,replacedBookReferences:patchedIds,readOnlyPreparation:true};
}
