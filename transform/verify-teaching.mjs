import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const directory=path.dirname(fileURLToPath(import.meta.url));
const normalize=text=>text.replaceAll('\r\n','\n');
const source=normalize(fs.readFileSync(path.join(directory,'teaching-engine.js'),'utf8')).trim();
const context={};vm.runInNewContext(source+'\nglobalThis.engine=ToyEngine;',context);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-12,`${a} != ${b}`);
const engine=context.engine;
for(const batch of [1,2,4,8])for(const layers of [2,3,6]){
 const trace=engine.run({batch,layers});
 for(let i=0;i<layers;i++){
  const block=trace.blocks[i];assert.equal(block.input,i?trace.blocks[i-1].output:trace.embedding);
  for(let b=0;b<batch;b++)for(let t=0;t<4;t++){
   for(let d=0;d<8;d++){
    near(block.norm2.input[b][t][d],block.input[b][t][d]+block.attnOut[b][t][d]);
    near(block.output[b][t][d],block.residual1[b][t][d]+block.mlp[b][t][d]);
   }
   for(const head of block.attention[b]){near(head[t].reduce((a,b)=>a+b,0),1);for(let k=t+1;k<4;k++)near(head[t][k],0);}
  }
 }
}
const generation=engine.run({batch:1,layers:3,inputIds:[[1,2,3]]});
assert.equal(generation.config.T,3);assert.equal(generation.ids[0].includes(7),false);
generation.logits[0][2].forEach((value,i)=>near(value,generation.lastLogits[0][0][i]));
near(generation.probs[0][0].reduce((a,b)=>a+b,0),1);
near(engine.softmax([.2,.2,1.1,.1,.1,.1,.1,2.8])[7],0.6249794024599293);
const decode=value=>value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot);/gi,(match,entity)=>entity[0]==='#'?String.fromCodePoint(parseInt(entity.slice(entity[1].toLowerCase()==='x'?2:1),entity[1].toLowerCase()==='x'?16:10)):({amp:'&',lt:'<',gt:'>',quot:'"'}[entity]||match));
for(const filename of ['transformer-structure-explorer.html','transformer-structure-explorer-matrices.html']){
 let text=normalize(fs.readFileSync(path.join(directory,filename),'utf8'));
 if(!filename.endsWith('-matrices.html'))text=decode(text.match(/data-srcdoc="([\s\S]*?)"(?=\s*(?:>|style=))/)[1]);
 assert.equal(text.split('/* BEGIN SHARED TEACHING ENGINE */')[1].split('/* END SHARED TEACHING ENGINE */')[0].trim(),source,filename+' has a stale exported engine');
 for(const match of text.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))new vm.Script(match[1]);
}
console.log('PASS: residual continuity, causal masks, softmax, three-token generation, shared exports and script syntax.');
