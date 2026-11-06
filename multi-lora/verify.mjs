import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const window = {};
vm.runInNewContext(fs.readFileSync(new URL('./lesson.js',import.meta.url),'utf8'), {window});
const lesson=window.LESSON, clone=x=>JSON.parse(JSON.stringify(x));
function build(scenario) {
 const params={scenario},before=JSON.stringify(params),data=clone(lesson.build(params));
 assert.equal(JSON.stringify(params),before,'build must not mutate params');
 assert.deepEqual(data,clone(lesson.build(params)),'deterministic build');
 assert.equal(data.steps.length,9);
 const nodes=new Set(data.nodes.map(n=>n.id)),edges=new Set(data.edges.map(e=>e.id));
 assert.equal(nodes.size,data.nodes.length);assert.equal(edges.size,data.edges.length);
 for(const e of data.edges){assert(nodes.has(e.from)&&nodes.has(e.to));for(const s of e.steps)assert(s>=1&&s<=9);}
 for(const step of data.steps){for(const id of step.activeNodes)assert(nodes.has(id));for(const id of step.activeEdges)assert(edges.has(id));for(const table of step.tables||[])for(const row of table.rows){assert.equal(row.length,table.headers.length);for(const v of row)assert(typeof v==='string'||typeof v==='number'&&Number.isFinite(v));}}
 return data;
}

let reference;
for(const scenario of ['mixed','slot-swap']){
 const d=build(scenario),a=d.audit;
 // Independent oracle: form each row's dense effective W + (alpha/r) B A.
 const expected=a.X.map((x,i)=>a.W.map((base,out)=>{
  const ad=a.adapters.find(v=>v.id===a.rows[i].adapter);
  return x.reduce((sum,v,input)=>sum+v*(base[input]+(ad?ad.alpha/ad.rank*ad.B[out].reduce((n,b,k)=>n+b*ad.A[k][input],0):0)),0);
 }));
 assert.deepEqual(a.Y,expected);assert.deepEqual(a.Y,[[7,1],[6,-2],[-2,-2],[1,-2]]);
 assert.deepEqual(a.Y[3],a.y0[3]);assert.deepEqual(a.delta[3],[0,0]);
 for(let i=0;i<a.rows.length;i++){if(a.rows[i].adapter===0)assert.equal(a.slotIndices[i],-1);else assert.equal(a.slots[a.slotIndices[i]],a.rows[i].adapter);}
 for(const ad of a.adapters)for(let i=0;i<ad.B.length;i++)assert.equal(ad.scaledB[i][0],ad.alpha/ad.rank*ad.B[i][0]);
 if(reference)assert.deepEqual(a.Y,reference);reference=a.Y;
 assert.equal(d.steps[0].tables[0].rows[0][3],'待映射');assert.equal(d.steps[6].tables.at(-1).rows[0].at(-1),'等待');
}
console.log('PASS multi-lora: independent dense oracle, scale exactly once, base row, slot permutation invariance');

const chain=JSON.parse(fs.readFileSync(new URL('./call-chain.json',import.meta.url),'utf8'));
let nodeCount=0,targetCount=0;
for(const variant of chain.variants){
 assert.equal(variant.repositories.vllm.commit,'295c062db8a48ea73bbd05d1174cb37d24bf86f9');
 const ids=new Map(variant.nodes.map(n=>[n.id,n]));assert.equal(ids.size,variant.nodes.length);
 for(const n of variant.nodes){
  nodeCount++;assert(n.parent===null||ids.has(n.parent));const seen=new Set([n.id]);let parent=n.parent;
  while(parent!==null){assert(!seen.has(parent),'parent cycle');seen.add(parent);parent=ids.get(parent).parent;}
  for(const key of ['title','summary','input','changes','output','resume'])assert(typeof n[key]==='string'&&n[key].length>0);
  assert(n.evidence.length>0);for(const ev of n.evidence){assert.equal(ev.repo,'vllm');assert(ev.path.startsWith('vllm/'));assert(Number.isInteger(ev.line)&&ev.line>0);if(ev.end)assert(ev.end>=ev.line);}
  for(const target of n.targets){targetCount++;assert(target.action.params.scenario);const data=build(target.action.params.scenario);assert(target.action.step>=1&&target.action.step<=data.steps.length);}
 }
}
console.log(`PASS call-chain: ${chain.variants.length} variants, ${nodeCount} nodes, ${targetCount} scenario/step targets`);
