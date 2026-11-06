import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context={window:{}};
vm.runInNewContext(fs.readFileSync(new URL('./lesson.js',import.meta.url),'utf8'),context);
const lesson=context.window.LESSON;
for(const c of lesson.controls) {
  if(c.type==='select')assert.ok(c.options.some(o=>String(o.value)===String(c.value)));
  else for(const value of [c.min,c.value,c.max]) {
    assert.ok(value>=c.min&&value<=c.max);
    const ticks=(value-c.min)/c.step;
    assert.ok(Math.abs(ticks-Math.round(ticks))<1e-7,`${c.id} boundary/default violates its input step`);
  }
}
const near=(a,b,eps=1e-12)=>assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`);
const sum=xs=>xs.reduce((a,b)=>a+b,0);
const finite=value=>{if(typeof value==='number')assert.ok(Number.isFinite(value));else if(Array.isArray(value))value.forEach(finite);else if(value&&typeof value==='object')Object.values(value).forEach(finite);};
function validate(view) {
  finite(view);assert.ok(view.steps.length>=5);
  const ids=new Set(view.nodes.map(x=>x.id)),edges=new Map(view.edges.map(x=>[x.id,x]));
  assert.equal(ids.size,view.nodes.length);
  for(const n of view.nodes){assert.ok(n.col>=0&&n.col<=2);assert.ok(n.readyAt<=view.steps.length);}
  for(const e of view.edges){assert.ok(ids.has(e.from)&&ids.has(e.to));for(const s of e.steps)assert.ok(s>=1&&s<=view.steps.length);}
  view.steps.forEach((s,i)=>{for(const n of s.activeNodes)assert.ok(ids.has(n));for(const id of s.activeEdges)assert.ok(edges.get(id)?.steps.includes(i+1));});
}
const plain=lesson.calculate({topK:0,topP:1,temperature:1});
[0.5,0.25,0.125,0.0625,0.03125,0.03125].forEach((x,i)=>near(x,plain.final[i]));
const example=lesson.calculate();
[4/7,2/7,1/7,0,0,0].forEach((x,i)=>near(x,example.final[i]));
assert.equal(example.selected,1);assert.equal(example.stop,false);
const hotter=lesson.calculate({temperature:2,topK:0,topP:1});
near(hotter.final[0]/hotter.final[1],Math.sqrt(2));
const boundary=lesson.calculate({u:example.cdf[0]});assert.equal(boundary.selected,1);
assert.equal(lesson.calculate({u:0}).selected,0);assert.equal(lesson.calculate({u:0.999999}).selected,2);
const tie=lesson.calculate({scenario:'tie',topK:1,topP:1});
assert.equal(tie.keepK.filter(Boolean).length,2);near(tie.final[0],0.5);near(tie.final[1],0.5);
const eos=lesson.calculate({scenario:'eos',topK:1,topP:1,u:0});assert.equal(eos.selected,5);assert.equal(eos.stop,true);
let cases=0;
for(const scenario of ['clear','tie','eos'])for(const temperature of [0.05,0.5,1,2])for(const topK of [0,1,3,6])for(const topP of [0.05,0.5,0.9,1])for(const u of [0,0.6,0.999999]) {
  const params=Object.freeze({scenario,temperature,topK,topP,u});
  const t=lesson.calculate(params);
  for(const probabilities of [t.probabilities,t.afterK,t.final]){near(sum(probabilities),1);assert.ok(probabilities.every(x=>x>=0&&x<=1));}
  assert.ok(t.keepP.some(Boolean));assert.ok(t.keepK[t.selected]&&t.keepP[t.selected]);
  assert.ok(u>=t.lower&&u<t.upper);near(t.cdf.at(-1),1);assert.ok(t.cdf.every((v,i)=>i===0||v>=t.cdf[i-1]));
  t.final.forEach((x,i)=>{if(!t.keepK[i]||!t.keepP[i])near(x,0);});
  const kept=t.ranked.filter(x=>x.keep);
  assert.ok(sum(kept.map(x=>x.p))+1e-12>=topP);
  if(topP<1&&kept.length>1)assert.ok(sum(kept.slice(0,-1).map(x=>x.p))<topP+1e-12);
  cases++;
}
for(const scenario of ['clear','tie','eos']) {
  const a=lesson.calculate({scenario,strategy:'greedy'}),b=lesson.calculate({scenario,strategy:'greedy',temperature:0.05,topK:6,topP:0.05,u:0.999999});
  assert.equal(a.selected,b.selected);assert.equal(a.selected,scenario==='eos'?5:0);assert.equal(a.stop,scenario==='eos');
  validate(lesson.build({scenario,strategy:'greedy'}));
}
for(const scenario of ['clear','tie','eos'])for(const strategy of ['sample','greedy']) {
  const params=Object.freeze({scenario,strategy}),before=JSON.stringify(params),view=lesson.build(params);
  validate(view);assert.equal(JSON.stringify(params),before);assert.equal(JSON.stringify(view),JSON.stringify(lesson.build(params)));
}
console.log(`Sampling: ${cases} probability/filter/u traces passed; known fractions, CDF boundaries, tie handling, greedy, EOS and graph verified.`);
