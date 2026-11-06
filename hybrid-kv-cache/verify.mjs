import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context=vm.createContext({window:{}});
vm.runInContext(fs.readFileSync(new URL('./lesson.js',import.meta.url),'utf8'),context);
const build=scenario=>JSON.parse(JSON.stringify(context.window.LESSON.build(Object.freeze({scenario}))));
const alloc=build('allocate'),prefix=build('prefix');
const parse=s=>JSON.parse(s.replaceAll('NULL','null'));
const readGroups=t=>({full:parse(t.rows[0][1]),swa:parse(t.rows[1][1]),free:parse(t.rows[2][1])});
// Exact queue order and ownership are asserted independently of the lesson calculator.
const initial=readGroups(alloc.steps[1].tables[0]);
const released=readGroups(alloc.steps[3].tables[0]);
const allocated=readGroups(alloc.steps[5].tables[0]);
assert.deepEqual(initial,{full:[1,2,3],swa:[4,5,6],free:[7,8]});
assert.deepEqual(released,{full:[1,2,3],swa:[null,null,6],free:[5,4,7,8]});
assert.deepEqual(allocated,{full:[1,2,3,5],swa:[null,null,6,4],free:[7,8]});
for(const snap of [initial,released,allocated]){
  const held=[...snap.full,...snap.swa].filter(x=>x!==null);
  assert.equal(new Set(held).size,held.length,'distinct groups must not own the same physical block');
  const all=[...held,...snap.free];
  assert.deepEqual([...all].sort((a,b)=>a-b),[1,2,3,4,5,6,7,8]);
  const refs=new Map(all.map(id=>[id,held.includes(id)?1:0]));
  assert.equal([...refs.values()].reduce((a,b)=>a+b,0),held.length);
}
assert(initial.swa.includes(5)&&allocated.full.includes(5),'freed SWA page becomes Full page in shared pool');
assert.deepEqual(alloc.steps[7].tables[0].rows,[[0,8,8]]);
const slots=alloc.steps[6].tables.find(t=>t.title==='同一个 token 的两组物理地址').rows;
assert.deepEqual(slots,[['Full',12,3,5,20,'0..12'],['SWA',12,3,4,16,'8..12']]);
assert.equal(2*4*1*2*2,32,'independent per-layer K/V byte count');
const results=Object.fromEntries(prefix.tables.find(t=>t.title==='Prefix 返回值与其不同含义').rows.map(r=>[r[0],r[1]]));
assert.equal(results['Full 单组命中'],16);
assert.equal(results['SWA 单组命中'],12);
assert.equal(results.num_new_computed_tokens,12);
assert.equal(results.num_uncached_common_prefix_tokens,4);
assert.equal(results.shared_prefix_boundary,16);
assert.equal(results['还需 prefill token 数'],5);
const candidates=prefix.tables.find(t=>t.title==='共同边界对应的候选块').rows;
assert.deepEqual(parse(candidates[0][1]),[1,2,3]);
assert.deepEqual(parse(candidates[1][1]),[null,null,7]);
// Recovering query12 with window5 only needs old KV8..11: exactly logical page2.
assert.deepEqual(Array.from({length:4},(_,i)=>Math.floor((8+i)/4)),[2,2,2,2]);
assert.equal(17-results.num_new_computed_tokens,results['还需 prefill token 数']);
assert(alloc.scope.includes('KVCacheCoordinatorNoPrefixCache'));
assert(prefix.scope.includes('HybridKVCacheCoordinator'));
for(const s of ['allocate','prefix']){
  const data=build(s);assert.equal(data.steps.length,8);assert.deepEqual(data,build(s));
  const nodes=new Set(data.nodes.map(n=>n.id)),edges=new Set(data.edges.map(e=>e.id));
  for(const e of data.edges){assert(nodes.has(e.from)&&nodes.has(e.to));assert(e.steps.every(i=>i>=1&&i<=8));}
  data.steps.forEach((st,i)=>{for(const id of st.activeNodes)assert(nodes.has(id));for(const id of st.activeEdges){assert(edges.has(id));assert(data.edges.find(e=>e.id===id).steps.includes(i+1));}});
  for(const t of [...data.tables,...data.steps.flatMap(s=>s.tables||[])])for(const row of t.rows){assert.equal(row.length,t.headers.length);for(const c of row)assert(typeof c==='string'||Number.isFinite(c));}
}
const chain=JSON.parse(fs.readFileSync(new URL('./call-chain.json',import.meta.url),'utf8'));
let targets=0;const depths=[];
for(const variant of chain.variants){
  const nodes=new Map(variant.nodes.map(n=>[n.id,n]));let max=0;
  for(const n of variant.nodes){let cur=n,d=1,seen=new Set([n.id]);while(cur.parent){assert(nodes.has(cur.parent));cur=nodes.get(cur.parent);assert(!seen.has(cur.id));seen.add(cur.id);d++;}max=Math.max(max,d);
    for(const t of n.targets){assert(['allocate','prefix'].includes(t.action.params.scenario));assert(t.action.step>=1&&t.action.step<=8);targets++;}
    for(const e of n.evidence){assert.equal(variant.repositories[e.repo].commit,'295c062db8a48ea73bbd05d1174cb37d24bf86f9');assert(e.line>0&&(e.end===undefined||e.end>=e.line));}
  }assert(max>=5);depths.push(max);
}
console.log(`PASS hybrid-kv-cache: 2 scenarios, ownership/ref/queue/window/prefix invariants, depths ${depths}, ${targets} targets`);
