import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assertPreflightTarget,inspectFreshProject,TARGET_SCRIPT,TARGET_BOOK} from './v7-new-script-preflight.mjs';
const inspect=f=>inspectFreshProject(f);
test('new V7 QA script and isolated workbook are strictly pinned',()=>{
 assert.doesNotThrow(()=>assertPreflightTarget(TARGET_SCRIPT,TARGET_BOOK));
 for(const script of [
 '1OCdXD7vllGyvz0cuV1Ld0hxhv03EF4TLLfHnvhTFMpbLSVj7XD8k2X8H',
 '1N6gLsSpcfsumKUfnY-VIpy2p1KtfrGI6PE1MZ8HXYIZecDjYcwP72QnF',
 '1Ywd72VfivnefEJMAZQ42ojw0QlfjyM1CUsbqlOJQnMkebamiZPAwvMM5',
 'not-a-project'
 ])assert.throws(()=>assertPreflightTarget(script,TARGET_BOOK),/WRONG_TARGET/);
 assert.throws(()=>assertPreflightTarget(TARGET_SCRIPT,'production-book'),/WRONG_TARGET/);
});
test('brand-new project with default stub or empty script passes read-only inspection',()=>{
 assert.deepEqual(inspect({'Code.js':'function myFunction() {\n\n}\n','appsscript.json':'{"timeZone":"Asia/Ho_Chi_Minh"}'}),{defaultStub:true,fileCount:2});
 assert.deepEqual(inspect({'Code.js':'','appsscript.json':'{}'}),{defaultStub:false,fileCount:2});
 assert.deepEqual(inspect({'appsscript.json':'{}'}),{defaultStub:false,fileCount:1});
});
test('existing code is a hard stop, not silently overwritten',()=>{
 assert.throws(()=>inspect({'Code.js':'function writeStock() {}'}),/NONEMPTY_SOURCE_REVIEW_REQUIRED/);
 assert.throws(()=>inspect({'Code.js':'var secret = 123;'}),/NONEMPTY_SOURCE_REVIEW_REQUIRED/);
 assert.throws(()=>inspect({'WebApp.html':'<html></html>'}),/EXISTING_PROJECT_FILES_REVIEW_REQUIRED/);
 assert.throws(()=>inspect({'private.gs':'function anything() {}'}),/EXISTING_PROJECT_FILES_REVIEW_REQUIRED/);
});
test('project with deployment settings is not treated as fresh',()=>{
 assert.throws(()=>inspect({'appsscript.json':'{"webapp":{"access":"ANYONE"}}'}),/EXISTING_DEPLOYMENT_CONFIG_REVIEW_REQUIRED/);
 assert.throws(()=>inspect({'appsscript.json':'{"executionApi":{"access":"ANYONE"}}'}),/EXISTING_DEPLOYMENT_CONFIG_REVIEW_REQUIRED/);
 assert.throws(()=>inspect({'appsscript.json':'broken'}),/MANIFEST_INVALID/);
});
test('runner contains read-only clasp pull, never push or source mutations',()=>{
 const s=fs.readFileSync(new URL('./v7-new-script-preflight.mjs',import.meta.url),'utf8');
 assert.ok(s.includes("spawnSync('clasp',['pull']"));
 assert.ok(!/spawnSync\s*\(\s*['"]clasp['"]\s*,\s*\[\s*['"](?:push|deploy|create-deployment)/.test(s));
 assert.ok(!/SpreadsheetApp\.|setValues|appendRow|setProperty/.test(s));
 assert.ok(s.includes('NO_WRITES'));
});
