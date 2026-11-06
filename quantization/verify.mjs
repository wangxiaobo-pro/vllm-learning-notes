import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context={window:{}};
vm.runInNewContext(fs.readFileSync(new URL('./lesson.js',import.meta.url),'utf8'),context);
const lesson=context.window.LESSON;
const near=(a,b,eps=1e-10)=>assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`);
const finite=value=>{if(typeof value==='number')assert.ok(Number.isFinite(value));else if(Array.isArray(value))value.forEach(finite);else if(value&&typeof value==='object')Object.values(value).forEach(finite);};
function validate(view) {
  finite(view);assert.equal(view.steps.length,7);
  const ids=new Set(view.nodes.map(x=>x.id)),edges=new Map(view.edges.map(x=>[x.id,x]));assert.equal(ids.size,view.nodes.length);
  for(const n of view.nodes){assert.ok(n.col>=0&&n.col<=2);assert.ok(n.readyAt<=view.steps.length);}
  for(const e of view.edges){assert.ok(ids.has(e.from)&&ids.has(e.to));for(const s of e.steps)assert.ok(s>=1&&s<=view.steps.length);}
  view.steps.forEach((s,i)=>{for(const n of s.activeNodes)assert.ok(ids.has(n));for(const id of s.activeEdges)assert.ok(edges.get(id)?.steps.includes(i+1));});
}
const manual=lesson.calculate({calibration:'manual',manualScale:0.5,bits:'8'});
[-2,-1,1,2,-16,-8,0,1].forEach((x,i)=>assert.equal(manual.cells[i].q,x));near(manual.mse,0.00625);
const half=lesson.calculate({scenario:'ties',calibration:'manual',manualScale:0.5});
[-2,-2,0,0,2,2,0,4].forEach((x,i)=>near(half.cells[i].q,x));
const affine=lesson.calculate({scenario:'positive',scheme:'affine',calibration:'manual',manualScale:0.5,manualZero:3,bits:'8'});
[3,5,7,9,9,11,13,15].forEach((x,i)=>assert.equal(affine.cells[i].q,x));near(affine.mse,0);
const tensor=lesson.calculate({granularity:'tensor'}),channel=lesson.calculate({granularity:'channel'}),group=lesson.calculate({granularity:'group',groupSize:'2'});
near(tensor.groups[0].scale,8/7);near(channel.groups[0].scale,1/7);near(channel.groups[1].scale,8/7);
assert.equal(group.groups.length,4);near(group.groups[3].scale,0.4/7);
assert.ok(channel.mse<tensor.mse);assert.ok(group.mse<channel.mse);
const clipped=lesson.calculate({rangeFactor:0.25});assert.ok(clipped.clipped>0);assert.ok(clipped.maxError>clipped.groups[0].scale/2);
let cases=0;
for(const scenario of ['mixed','positive','ties'])for(const scheme of ['symmetric','affine'])for(const granularity of ['tensor','channel','group'])for(const bits of ['4','8'])for(const calibration of ['minmax','manual'])for(const rangeFactor of [0.25,1,2]) {
  const params=Object.freeze({scenario,scheme,granularity,bits,calibration,rangeFactor,manualScale:0.5,manualZero:200});
  const t=lesson.calculate(params);
  assert.equal(t.groups.length,granularity==='tensor'?1:granularity==='channel'?2:4);
  for(const g of t.groups){assert.ok(g.scale>0);assert.ok(Number.isInteger(g.zero));assert.ok(g.zero>=t.qmin&&g.zero<=t.qmax);near(g.scale*(g.zero-g.zero),0);if(scheme==='symmetric')assert.equal(g.zero,0);}
  for(const c of t.cells){assert.ok(Number.isInteger(c.q));assert.ok(c.q>=t.qmin&&c.q<=t.qmax);near(c.dequant,c.scale*(c.q-c.zero));near(c.error,c.dequant-c.x);if(!c.clipped)assert.ok(Math.abs(c.error)<=c.scale/2+1e-10);}
  const independentMse=t.matrix.reduce((sum,row,r)=>sum+row.reduce((s,x,c)=>s+(t.dequant[r][c]-x)**2,0),0)/8;
  near(t.mse,independentMse);
  for(let r=0;r<2;r++) {const expected=t.matrix[r][0]-t.matrix[r][1]+0.5*t.matrix[r][2]+2*t.matrix[r][3];near(t.output[r],expected);}
  validate(lesson.build(params));cases++;
}
const oneRowGroup=lesson.calculate({granularity:'group',groupSize:'4'});near(oneRowGroup.mse,channel.mse);
const params=Object.freeze({scheme:'affine',granularity:'group'}),before=JSON.stringify(params);
assert.equal(JSON.stringify(lesson.build(params)),JSON.stringify(lesson.build(params)));assert.equal(JSON.stringify(params),before);
console.log(`Quantization: ${cases} scheme/granularity/bit/range traces passed; exact codes, ties-even, zero point, clipping, error bounds and downstream outputs verified.`);
