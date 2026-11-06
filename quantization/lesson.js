(() => {
  'use strict';
  const defaults={scenario:'mixed',scheme:'symmetric',granularity:'tensor',bits:'4',groupSize:'2',calibration:'minmax',rangeFactor:1,manualScale:0.5,manualZero:3};
  const matrices={mixed:[[-1,-0.5,0.5,1],[-8,-4,0.2,0.4]],positive:[[0,1,2,3],[3,4,5,6]],ties:[[-1.25,-0.75,-0.25,0.25],[0.75,1.25,0,2]]};
  const f=x=>Number(x.toFixed(6));
  const vec=xs=>`[${xs.map(f).join(', ')}]`;
  const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
  // JavaScript Math.round uses a different rule for negative half-way values.
  const roundEven=x=>{const lower=Math.floor(x),fraction=x-lower;return fraction<0.5?lower:fraction>0.5?lower+1:(lower%2===0?lower:lower+1);};
  function calculate(input={}) {
    const p={...defaults,...input}, matrix=matrices[p.scenario].map(row=>[...row]);
    const bits=Number(p.bits), symmetric=p.scheme==='symmetric';
    const qmax=symmetric?2**(bits-1)-1:2**bits-1,qmin=symmetric?-qmax:0;
    const groups=[];
    const groupId=(r,c)=>p.granularity==='tensor'?'tensor':p.granularity==='channel'?`out${r}`:`out${r}/g${Math.floor(c/Number(p.groupSize))}`;
    const cells=matrix.flatMap((row,r)=>row.map((x,c)=>({r,c,x,group:groupId(r,c)})));
    for(const id of [...new Set(cells.map(x=>x.group))]) {
      const members=cells.filter(x=>x.group===id),lo=Math.min(0,...members.map(x=>x.x)),hi=Math.max(0,...members.map(x=>x.x));
      const lower=lo*Number(p.rangeFactor),upper=hi*Number(p.rangeFactor);
      let scale,zero;
      if(p.calibration==='manual') {scale=Number(p.manualScale);zero=symmetric?0:clamp(roundEven(Number(p.manualZero)),qmin,qmax);}
      else if(symmetric) {scale=Math.max(Math.abs(lower),Math.abs(upper))/qmax||1;zero=0;}
      else {scale=(upper-lower)/(qmax-qmin)||1;zero=clamp(roundEven(qmin-lower/scale),qmin,qmax);}
      groups.push({id,members:members.map(x=>`W[${x.r},${x.c}]`),lo,hi,lower,upper,scale,zero,representedLow:scale*(qmin-zero),representedHigh:scale*(qmax-zero)});
    }
    for(const cell of cells) {
      const g=groups.find(g=>g.id===cell.group);
      cell.scale=g.scale;cell.zero=g.zero;cell.scaled=cell.x/g.scale;cell.rounded=roundEven(cell.scaled);cell.beforeClamp=cell.rounded+g.zero;
      cell.q=clamp(cell.beforeClamp,qmin,qmax);cell.clipped=cell.q!==cell.beforeClamp;cell.dequant=g.scale*(cell.q-g.zero);cell.error=cell.dequant-cell.x;
    }
    const dequant=matrix.map((row,r)=>row.map((_,c)=>cells.find(x=>x.r===r&&x.c===c).dequant));
    const codes=matrix.map((row,r)=>row.map((_,c)=>cells.find(x=>x.r===r&&x.c===c).q));
    const probe=[1,-1,0.5,2],matvec=w=>w.map(row=>row.reduce((sum,x,i)=>sum+x*probe[i],0));
    const output=matvec(matrix),approxOutput=matvec(dequant),mse=cells.reduce((sum,x)=>sum+x.error*x.error,0)/cells.length,maxError=Math.max(...cells.map(x=>Math.abs(x.error)));
    return {params:p,bits,qmin,qmax,matrix,groups,cells,dequant,codes,probe,output,approxOutput,mse,maxError,clipped:cells.filter(x=>x.clipped).length};
  }
  function build(input) {
    const t=calculate(input),p=t.params,symmetric=p.scheme==='symmetric',manual=p.calibration==='manual';
    const inputTable={title:'权重矩阵 W[out_channel, in_feature]',headers:['输出通道','W 行','分组方式'],rows:t.matrix.map((row,r)=>[r,vec(row),p.granularity==='tensor'?'整个矩阵共用':p.granularity==='channel'?'每行独立':`每行每 ${p.groupSize} 个输入维一组`])};
    const rangeTable={title:'每组的校准范围（始终包含零）',headers:['组','成员','原 min','原 max','乘范围系数后的 min','乘范围系数后的 max'],rows:t.groups.map(g=>[g.id,g.members.join(', '),g.lo,g.hi,f(g.lower),f(g.upper)])};
    const paramTable={title:'真正用于量化的参数与可表示范围',headers:['组','scale s','zero-point z','整数范围','可表示下界','可表示上界'],rows:t.groups.map(g=>[g.id,f(g.scale),g.zero,`[${t.qmin}, ${t.qmax}]`,f(g.representedLow),f(g.representedHigh)])};
    const roundingTable={title:'除以 scale 后采用 ties-to-even 舍入',headers:['位置 / 组','原值 x','s','x/s','round_even(x/s)'],rows:t.cells.map(x=>[`W[${x.r},${x.c}] / ${x.group}`,x.x,f(x.scale),f(x.scaled),x.rounded])};
    const codeTable={title:'加 zero-point，再裁剪为整数码',headers:['位置','舍入值','z','裁剪前整数','量化码 q','发生裁剪'],rows:t.cells.map(x=>[`W[${x.r},${x.c}]`,x.rounded,x.zero,x.beforeClamp,x.q,x.clipped?'是':'否'])};
    const errorTable={title:'反量化值和有符号误差',headers:['位置','原值 x','q','s·(q−z)','误差 x̂−x','绝对误差'],rows:t.cells.map(x=>[`W[${x.r},${x.c}]`,x.x,x.q,f(x.dequant),f(x.error),f(Math.abs(x.error))])};
    const outputTable={title:'下游线性层：浮点参考计算',headers:['输出通道','原 W·v','反量化 Ŵ·v','输出误差'],rows:t.output.map((x,i)=>[i,f(x),f(t.approxOutput[i]),f(t.approxOutput[i]-x)])};
    const labels=t.cells.map(x=>`W${x.r}${x.c}`);
    const valuesPlot={type:'bars',title:'同一权重的原值与反量化值',labels,series:[{label:'原权重',values:t.cells.map(x=>x.x)},{label:'反量化权重',values:t.cells.map(x=>x.dequant)}],unit:'权重值'};
    const errorPlot={type:'bars',title:'每个权重的绝对误差',labels,series:[{label:'|x̂−x|',values:t.cells.map(x=>Math.abs(x.error))}],unit:'绝对误差'};
    const nodes=[
      {id:'weights',title:'读取浮点权重',lane:'输入张量',detail:`W[2,4]；第 0 行 ${vec(t.matrix[0])}；第 1 行 ${vec(t.matrix[1])}`,row:0,col:0,readyAt:0},
      {id:'layout',title:'确定参数共享范围',lane:'量化配置',detail:`${p.granularity}；${t.groups.length} 组；${p.bits} bit ${p.scheme}`,row:0,col:2,readyAt:0},
      {id:'ranges',title:manual?'读取手动参数':'统计每组 min/max',lane:manual?'参数输入':'校准',detail:manual?`所有组使用 s=${p.manualScale}；z=${symmetric?0:clamp(roundEven(Number(p.manualZero)),t.qmin,t.qmax)}`:`范围系数 ${p.rangeFactor}；${t.groups.map(g=>`${g.id}: [${f(g.lower)},${f(g.upper)}]`).join('；')}`,row:1,col:1,readyAt:2},
      {id:'params',title:'得到 scale 与 zero-point',lane:'每组元数据',detail:t.groups.map(g=>`${g.id}: s=${f(g.scale)}, z=${g.zero}`).join('；'),row:2,col:1,readyAt:3},
      {id:'round',title:'除以 scale 并舍入',lane:'量化计算',detail:`round_even(x/s) = ${vec(t.cells.map(x=>x.rounded))}`,row:3,col:0,readyAt:4},
      {id:'codes',title:'加零点与整数裁剪',lane:'量化存储',detail:`q 行 0 ${vec(t.codes[0])}；行 1 ${vec(t.codes[1])}；裁剪 ${t.clipped} 项`,row:4,col:0,readyAt:5},
      {id:'dequant',title:'用参数重建近似权重',lane:'反量化参考',detail:`Ŵ 行 0 ${vec(t.dequant[0])}；行 1 ${vec(t.dequant[1])}`,row:5,col:1,readyAt:6},
      {id:'probe',title:'下游输入向量',lane:'线性层输入',detail:`v = ${vec(t.probe)}`,row:5,col:2,readyAt:0},
      {id:'output',title:'比较误差和线性输出',lane:'下游消费者',detail:`MSE=${f(t.mse)}；Wv=${vec(t.output)}；Ŵv=${vec(t.approxOutput)}`,row:6,col:1,readyAt:7}
    ];
    const edges=[
      {id:'partition',from:'weights',to:'ranges',label:'W 各元素 → 对应分组',steps:[1,2]},
      {id:'config',from:'layout',to:'ranges',label:'轴 / group size / 校准或手动方式',steps:[1,2]},
      {id:'calibrate',from:'ranges',to:'params',label:manual?'手动 s,z → 校验整数范围':'每组范围 → s,z',steps:[3]},
      {id:'value',from:'weights',to:'round',label:'每个浮点 x',steps:[4]},
      {id:'scale',from:'params',to:'round',label:'所属组的正 scale s',steps:[4]},
      {id:'rounded',from:'round',to:'codes',label:'round_even(x/s)',steps:[5]},
      {id:'zero',from:'params',to:'codes',label:'z 与 [qmin,qmax]',steps:[5]},
      {id:'decode',from:'codes',to:'dequant',label:'整数码 q',steps:[6]},
      {id:'metadata',from:'params',to:'dequant',label:'反量化必须保留的 s,z',steps:[6]},
      {id:'reference',from:'weights',to:'output',label:'原 W：误差与原始输出的参考',steps:[7]},
      {id:'approx',from:'dequant',to:'output',label:'近似权重 Ŵ',steps:[7]},
      {id:'activation',from:'probe',to:'output',label:'浮点输入向量 v',steps:[7]}
    ];
    const steps=[
      {title:'按张量轴决定谁共享参数',summary:`W 的行是输出通道，列是输入特征。当前 ${p.granularity} 划分产生 ${t.groups.length} 组。`,activeNodes:['weights','layout','ranges'],activeEdges:['partition','config'],state:{ranges:`组与成员：${t.groups.map(g=>`${g.id}=${g.members.join('/')}`).join('；')}`},tables:[inputTable],plots:[],notes:['per-tensor 共用一套参数；per-channel 沿输出通道逐行；group 在每行输入维内分段，不跨行。']},
      {title:manual?'读取可调的手动 scale / zero-point':'统计并调整校准范围',summary:manual?`手动模式使用 s=${p.manualScale}；${symmetric?'对称量化强制 z=0。':`zero-point 先舍入为整数，再限制在 [${t.qmin},${t.qmax}]。`}`:`min/max 包含零，然后乘范围系数 ${p.rangeFactor}；小于 1 可主动缩窄范围观察裁剪。`,activeNodes:['ranges','layout'],activeEdges:['partition','config'],state:{ranges:nodes[2].detail},tables:manual?[inputTable]:[rangeTable],plots:[],notes:manual?['手动模式所有组共用相同输入 s,z，因此仅切换分组不会改变数值结果；自动校准才会为不同组产生不同参数。']:['这是当前小矩阵的 min/max 教学校准，不代表用大数据集统计过激活分布。全零组约定 s=1，以避免除零。']},
      {title:'确定整数范围、scale 与零点',summary:`${symmetric?`对称窄范围整数 [${t.qmin},${t.qmax}]，z=0。`:`Affine 使用无符号整数 [${t.qmin},${t.qmax}]，整数零点 z 映射回浮点 0。`}每组得到一套反量化需要的参数。`,activeNodes:['ranges','params'],activeEdges:['calibrate'],state:{params:nodes[3].detail},equation:manual?'s = 手动正数；z = symmetric ? 0 : clip(round_even(手动 z))':symmetric?'s=max(|a|,|b|)/qmax；z=0':'s=(b−a)/(qmax−qmin)；z=clip(round_even(qmin−a/s))',tables:[paramTable],plots:[],notes:[symmetric?'本页使用窄对称范围，最负的二进制整数码不使用；其他后端可以选择不同整数范围。':'舍入 zero-point 后可表示端点不必恰好等于校准 min/max；以表中的真实重建范围为准。']},
      {title:'逐元素除以所属组的 scale 并舍入',summary:'每个 x 使用自己的组参数。恰好位于两个整数中间时，选偶数整数，正负数遵守同一规则。',activeNodes:['weights','params','round'],activeEdges:['value','scale'],state:{round:nodes[4].detail},equation:'r = round_to_nearest_even(x/s)',tables:[roundingTable],plots:[],notes:['例如 ±0.5→0，±1.5→±2；本页显式实现 ties-to-even，不使用 JavaScript 默认 Math.round 代替。']},
      {title:'加 zero-point 并裁剪到整数码范围',summary:`q=clip(r+z,${t.qmin},${t.qmax})；当前 ${t.clipped} 项的舍入结果超过整数范围。`,activeNodes:['round','params','codes'],activeEdges:['rounded','zero'],state:{codes:nodes[5].detail},equation:'q=clip(round_even(x/s)+z, qmin, qmax)',tables:[codeTable],plots:[],notes:['q 是量化整数码，不能单独当成近似浮点权重；必须连同组映射和参数 s,z 才能解释。']},
      {title:'反量化：恢复可计算的近似权重',summary:'先减去 zero-point，再乘原组 scale，得到 Ŵ。此时信息损失无法自动恢复。',activeNodes:['codes','params','dequant'],activeEdges:['decode','metadata'],state:{dequant:nodes[6].detail},equation:'x̂=s·(q−z)',tables:[errorTable],plots:[valuesPlot],notes:['zero-point 对应的整数码重建为精确浮点零；未裁剪元素的舍入误差绝对值不超过 s/2（忽略机器浮点尾差）。']},
      {title:'把近似权重交给下游并量化误差',summary:`权重 MSE=${f(t.mse)}，最大绝对误差=${f(t.maxError)}。用相同 v=${vec(t.probe)} 比较 Wv 与 Ŵv。`,activeNodes:['weights','dequant','probe','output'],activeEdges:['reference','approx','activation'],state:{output:nodes[8].detail},equation:'MSE = mean((x̂−x)²)；y=Wv，ŷ=Ŵv',tables:[errorTable,outputTable],plots:[valuesPlot,errorPlot],notes:['这里实际算的是反量化后的浮点参考矩阵乘，不把它称为 INT4/INT8 硬件 GEMM，也不从 4/8 bit 推断加速比。']}
    ];
    return {scope:'均匀整数仿射量化的 2×4 权重教学例子；对称模式为 z=0 的特例，采用窄对称整数范围。逐组 min/max 或手动参数、ties-to-even 舍入、显式裁剪；不含 GPTQ/AWQ 优化、激活量化、打包或设备内核。',nodes,edges,steps,
      metrics:[{label:'参数组数',value:t.groups.length},{label:'量化整数范围',value:`[${t.qmin}, ${t.qmax}]`},{label:'MSE / 最大误差',value:`${f(t.mse)} / ${f(t.maxError)}`},{label:'裁剪数',value:`${t.clipped} / ${t.cells.length}`}],tables:[inputTable,paramTable,errorTable,outputTable],plots:[valuesPlot,errorPlot],notes:['FP8 是带指数和尾数的浮点格式，例如 E4M3、E5M2；也可配缩放因子，但不能把本页等间距整数 + zero-point 公式直接当作 FP8 编码。','更小的参数共享范围增加 scale / zero-point 元数据；本页只比较实际重建误差，不计算特定后端的存储布局或吞吐。']};
  }
  window.LESSON={title:'量化：整数码如何近似浮点权重',subtitle:'从分组、scale 与 zero-point，到舍入、裁剪、反量化以及下游线性层的实际误差。',kind:'基础知识',
    controls:[
      {id:'scenario',label:'权重场景',type:'select',value:defaults.scenario,options:[{value:'mixed',label:'通道尺度悬殊与离群值'},{value:'positive',label:'非负的偏移分布'},{value:'ties',label:'恰好半整数的舍入'}]},
      {id:'scheme',label:'整数量化方式',type:'select',value:defaults.scheme,options:[{value:'symmetric',label:'对称：z=0，窄有符号范围'},{value:'affine',label:'Affine：可变 z，无符号范围'}]},
      {id:'granularity',label:'参数共享粒度',type:'select',value:defaults.granularity,options:[{value:'tensor',label:'Per tensor：整个 W'},{value:'channel',label:'Per channel：每个输出通道'},{value:'group',label:'Group：每行内分组'}]},
      {id:'bits',label:'整数位宽',type:'select',value:defaults.bits,options:[{value:'4',label:'4 bit'},{value:'8',label:'8 bit'}]},
      {id:'groupSize',label:'每组输入维数',type:'select',value:defaults.groupSize,options:[{value:'2',label:'2 列一组'},{value:'4',label:'4 列一组'}],showIf:p=>p.granularity==='group'},
      {id:'calibration',label:'参数来源',type:'select',value:defaults.calibration,options:[{value:'minmax',label:'每组 min/max 校准'},{value:'manual',label:'手动 scale / zero-point'}]},
      {id:'rangeFactor',label:'校准范围系数',type:'range',value:defaults.rangeFactor,min:0.25,max:2,step:0.25,showIf:p=>p.calibration==='minmax'},
      {id:'manualScale',label:'手动 scale s > 0',type:'number',value:defaults.manualScale,min:0.01,max:4,step:0.01,showIf:p=>p.calibration==='manual'},
      {id:'manualZero',label:'手动 zero-point（限幅到码域）',type:'number',value:defaults.manualZero,min:0,max:255,step:1,showIf:p=>p.calibration==='manual'&&p.scheme==='affine'}
    ],calculate,build,
    sources:[{label:'Jacob 等：整数算术推理与仿射量化方案',url:'https://arxiv.org/abs/1712.05877'},{label:'PyTorch：per-channel scales、zero_points 与 axis',url:'https://docs.pytorch.org/docs/2.15/generated/torch.quantize_per_channel.html'},{label:'PyTorch：per-tensor scale 与 zero_point',url:'https://docs.pytorch.org/docs/2.15/generated/torch.quantize_per_tensor.html'},{label:'FP8 Formats for Deep Learning：E4M3 与 E5M2',url:'https://arxiv.org/abs/2209.05433'}],
    related:[{label:'模型结构与量化算子边界',href:'../model-architecture/index.html'},{label:'权重卸载与预取',href:'../weight-offload-prefetch/index.html'}]};
})();
