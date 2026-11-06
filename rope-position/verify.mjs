import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context={window:{}};
vm.runInNewContext(fs.readFileSync(new URL('./lesson.js',import.meta.url),'utf8'),context);
const lesson=context.window.LESSON;
const near=(a,b,eps=1e-10)=>assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`);
const finite=value=>{if(typeof value==='number')assert.ok(Number.isFinite(value));else if(Array.isArray(value))value.forEach(finite);else if(value&&typeof value==='object')Object.values(value).forEach(finite);};
function validate(view) {
  finite(view);
  assert.equal(view.steps.length,7);
  const ids=new Set(view.nodes.map(x=>x.id)),edges=new Map(view.edges.map(x=>[x.id,x]));
  assert.equal(ids.size,view.nodes.length);
  for(const n of view.nodes){assert.ok(n.col>=0&&n.col<=2);assert.ok(n.readyAt<=view.steps.length);}
  for(const e of view.edges){assert.ok(ids.has(e.from)&&ids.has(e.to));assert.ok(e.label);for(const s of e.steps)assert.ok(s>=1&&s<=view.steps.length);}
  view.steps.forEach((s,i)=>{for(const n of s.activeNodes)assert.ok(ids.has(n));for(const id of s.activeEdges)assert.ok(edges.get(id)?.steps.includes(i+1));});
}
const origin=lesson.calculate({scenario:'multi',qPosition:0,kPosition:0});
origin.q.forEach((v,i)=>near(v,origin.qRot[i]));origin.k.forEach((v,i)=>near(v,origin.kRot[i]));
near(origin.score,4.25);
const quarter=lesson.calculate({scenario:'single',degrees:90,qPosition:1,kPosition:0});
near(quarter.qRot[0],-2);near(quarter.qRot[1],1);near(quarter.score,-3);near(quarter.logit,-3/Math.sqrt(2));
let cases=0;
for(const scenario of ['single','multi','interpolation'])for(const qPosition of [0,1,7,64])for(const kPosition of [0,3,64])for(const base of [10,10000,100000]) {
  const params=Object.freeze({scenario,qPosition,kPosition,base,degrees:37,scale:2.5,commonShift:32});
  const before=JSON.stringify(params),t=lesson.calculate(params),view=lesson.build(params);
  assert.equal(JSON.stringify(params),before);assert.equal(JSON.stringify(view),JSON.stringify(lesson.build(params)));
  for(const x of t.pairs) {
    near(x.qNorm2,x.qRotNorm2);near(x.kNorm2,x.kRotNorm2);
    const delta=(t.n-t.m)*x.theta;
    const independent=(x.q[0]*x.k[0]+x.q[1]*x.k[1])*Math.cos(delta)+(x.q[1]*x.k[0]-x.q[0]*x.k[1])*Math.sin(delta);
    near(x.score,independent);near(x.score,x.relativeScore);near(x.score,x.shiftedScore);
  }
  near(t.score,t.relativeScore);near(t.score,t.shiftedScore);near(t.logit,t.score/Math.sqrt(t.d));validate(view);cases++;
}
const ordinary=lesson.calculate({scenario:'multi',qPosition:3,kPosition:5});
const scaleOne=lesson.calculate({scenario:'interpolation',qPosition:3,kPosition:5,scale:1});
near(ordinary.score,scaleOne.score);
const scaleTwo=lesson.calculate({scenario:'interpolation',qPosition:6,kPosition:10,scale:2});
near(ordinary.score,scaleTwo.score);scaleTwo.qRot.forEach((x,i)=>near(x,ordinary.qRot[i]));
const zeroFrequency=lesson.calculate({scenario:'single',degrees:0,qPosition:64,kPosition:0});
near(zeroFrequency.score,4);
console.log(`RoPE: ${cases} scenario/position/frequency traces passed; known rotations, relative identity, shift invariance, interpolation, graph and determinism verified.`);
