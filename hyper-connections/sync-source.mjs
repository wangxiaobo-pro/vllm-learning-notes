// Keep the editable fragment and standalone offline export in sync.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const directory=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(path.join(directory,'source.html'),'utf8').replaceAll('\r\n','\n').trim();
const file=path.join(directory,'index.html');
const original=fs.readFileSync(file,'utf8');
const newline=original.includes('\r\n')?'\r\n':'\n';
const exported=original.replaceAll('\r\n','\n');
const pattern=/data-srcdoc="([\s\S]*?)"(?=\s*(?:>|style=))/;
const decode=value=>value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot);/gi,(match,entity)=>entity[0]==='#'?String.fromCodePoint(parseInt(entity.slice(entity[1].toLowerCase()==='x'?2:1),entity[1].toLowerCase()==='x'?16:10)):({amp:'&',lt:'<',gt:'>',quot:'"'}[entity]||match));
const encode=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#x27;');
const match=exported.match(pattern);
assert.ok(match,'Missing exported document');
const content=decode(match[1]).replaceAll('\r\n','\n');
const start='<!-- BEGIN HYPER CONNECTIONS SOURCE -->',end='<!-- END HYPER CONNECTIONS SOURCE -->';
const a=content.indexOf(start),b=content.indexOf(end,a);
assert.ok(a>=0&&b>a,'Missing source markers');
if(process.argv.includes('--check')){
  assert.equal(content.slice(a+start.length,b).trim(),source,'Export is stale; run node hyper-connections/sync-source.mjs');
  console.log('PASS: HC source and offline export are identical.');
}else{
  const updated=content.slice(0,a)+start+'\n'+source+'\n'+end+content.slice(b+end.length);
  const result=exported.replace(pattern,()=> 'data-srcdoc="'+encode(updated)+'"');
  fs.writeFileSync(file,newline==='\n'?result:result.replaceAll('\n',newline));
  console.log('Synchronized HC source into the offline export.');
}
