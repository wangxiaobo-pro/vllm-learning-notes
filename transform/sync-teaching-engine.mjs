// Both exported pages inline the same editable engine so file:// stays offline.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const directory=path.dirname(fileURLToPath(import.meta.url));
const normalize=text=>text.replaceAll('\r\n','\n');
const engine=normalize(fs.readFileSync(path.join(directory,'teaching-engine.js'),'utf8')).trimEnd();
const start='/* BEGIN SHARED TEACHING ENGINE */',end='/* END SHARED TEACHING ENGINE */';
const replaceEngine=text=>{
  const a=text.indexOf(start),b=text.indexOf(end,a);
  if(a<0||b<0)throw new Error('Missing engine markers');
  return text.slice(0,a)+start+'\n'+engine+'\n'+end+text.slice(b+end.length);
};
const decode=value=>value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot);/gi,(match,entity)=>entity[0]==='#'?String.fromCodePoint(parseInt(entity.slice(entity[1].toLowerCase()==='x'?2:1),entity[1].toLowerCase()==='x'?16:10)):({amp:'&',lt:'<',gt:'>',quot:'"'}[entity]||match));
const encode=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#x27;');
for(const filename of ['transformer-structure-explorer-matrices.html','transformer-structure-explorer.html']){
  const file=path.join(directory,filename),original=fs.readFileSync(file,'utf8');
  const newline=original.includes('\r\n')?'\r\n':'\n';
  let text=normalize(original);
  text=filename.endsWith('-matrices.html')?replaceEngine(text):text.replace(/data-srcdoc="([\s\S]*?)"(?=\s*(?:>|style=))/,(_,content)=>'data-srcdoc="'+encode(replaceEngine(decode(content)))+'"');
  fs.writeFileSync(file,newline==='\n'?text:text.replaceAll('\n',newline));
}
console.log('Synchronized the shared engine into both offline pages.');
