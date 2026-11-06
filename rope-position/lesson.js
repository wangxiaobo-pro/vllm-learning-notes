(() => {
  'use strict';
  const defaults = {scenario:'multi', qPosition:1, kPosition:3, degrees:45, base:10000, scale:2, commonShift:5};
  const f = x => Number(x.toFixed(6));
  const vec = xs => `[${xs.map(f).join(', ')}]`;
  const dot = (a,b) => a.reduce((sum,x,i) => sum+x*b[i],0);
  const rotate = (v,angle) => [v[0]*Math.cos(angle)-v[1]*Math.sin(angle), v[0]*Math.sin(angle)+v[1]*Math.cos(angle)];
  function calculate(input = {}) {
    const p = {...defaults,...input};
    const q = p.scenario === 'single' ? [1,2] : [1,2,0.5,-1];
    const k = p.scenario === 'single' ? [2,1] : [2,1,1.5,0.5];
    const divisor = p.scenario === 'interpolation' ? Number(p.scale) : 1;
    const m = Number(p.qPosition)/divisor, n = Number(p.kPosition)/divisor;
    const pairs = Array.from({length:q.length/2}, (_,i) => {
      const theta = p.scenario === 'single' ? Number(p.degrees)*Math.PI/180 : Number(p.base)**(-2*i/q.length);
      const qPair=q.slice(2*i,2*i+2), kPair=k.slice(2*i,2*i+2);
      const qRot=rotate(qPair,m*theta), kRot=rotate(kPair,n*theta);
      const relativeK=rotate(kPair,(n-m)*theta);
      const shiftedQ=rotate(qPair,(m+Number(p.commonShift)/divisor)*theta);
      const shiftedK=rotate(kPair,(n+Number(p.commonShift)/divisor)*theta);
      return {i,theta,q:qPair,k:kPair,qAngle:m*theta,kAngle:n*theta,
        qCos:Math.cos(m*theta),qSin:Math.sin(m*theta),kCos:Math.cos(n*theta),kSin:Math.sin(n*theta),
        qRot,kRot,relativeK,qNorm2:dot(qPair,qPair),qRotNorm2:dot(qRot,qRot),kNorm2:dot(kPair,kPair),kRotNorm2:dot(kRot,kRot),
        score:dot(qRot,kRot),relativeScore:dot(qPair,relativeK),shiftedScore:dot(shiftedQ,shiftedK)};
    });
    const qRot=pairs.flatMap(x=>x.qRot), kRot=pairs.flatMap(x=>x.kRot);
    const score=pairs.reduce((s,x)=>s+x.score,0), relativeScore=pairs.reduce((s,x)=>s+x.relativeScore,0), shiftedScore=pairs.reduce((s,x)=>s+x.shiftedScore,0);
    return {params:p,q,k,d:q.length,divisor,m,n,pairs,qRot,kRot,score,relativeScore,shiftedScore,logit:score/Math.sqrt(q.length)};
  }
  function build(input) {
    const t=calculate(input), p=t.params, interpolation=p.scenario==='interpolation';
    const pairTable={title:'相邻维度配对与频率',headers:['配对 i','Q 子向量','K 子向量','θᵢ (rad/位置)','Q 有效位置','K 有效位置'],rows:t.pairs.map(x=>[x.i,vec(x.q),vec(x.k),f(x.theta),f(t.m),f(t.n)])};
    const angleTable={title:'角度 → 三角函数',headers:['配对','mθᵢ (rad)','cos(mθᵢ)','sin(mθᵢ)','nθᵢ (rad)','cos(nθᵢ)','sin(nθᵢ)'],rows:t.pairs.map(x=>[x.i,f(x.qAngle),f(x.qCos),f(x.qSin),f(x.kAngle),f(x.kCos),f(x.kSin)])};
    const rotationTable=which=>({title:`${which.toUpperCase()} 的旋转计算`,headers:['配对','原向量 [a,b]','第一维 a·cos−b·sin','第二维 a·sin+b·cos','原平方范数','旋转后平方范数'],rows:t.pairs.map(x=>[x.i,vec(x[which]),f(x[`${which}Rot`][0]),f(x[`${which}Rot`][1]),f(x[`${which}Norm2`]),f(x[`${which}RotNorm2`])])});
    const scoreTable={title:'相对位置恒等式逐对核算',headers:['配对','R((n−m)θᵢ)K','Q′·K′','Q·R((n−m)θᵢ)K','共同平移后点积'],rows:t.pairs.map(x=>[x.i,vec(x.relativeK),f(x.score),f(x.relativeScore),f(x.shiftedScore)])};
    const plots=t.pairs.map(x=>({type:'vectors',title:`配对 ${x.i}：原始与旋转后的 Q/K`,vectors:[{label:'Q',x:x.q[0],y:x.q[1]},{label:'Q′',x:x.qRot[0],y:x.qRot[1]},{label:'K',x:x.k[0],y:x.k[1]},{label:'K′',x:x.kRot[0],y:x.kRot[1]}]}));
    const policy=p.scenario==='single' ? `θ = ${p.degrees}°/位置 = ${f(t.pairs[0].theta)} rad/位置` : `θᵢ = base^(−2i/d)，base=${p.base}，d=${t.d}`;
    const positions=`位置 m=${p.qPosition}, n=${p.kPosition} → 有效位置 ${f(t.m)}, ${f(t.n)}`;
    const nodes=[
      {id:'q',title:'上游 Q 投影',lane:'一个 query',detail:`Q = ${vec(t.q)}；维数 d=${t.d}`,row:0,col:0,readyAt:0},
      {id:'policy',title:'位置与频率规则',lane:'位置参数',detail:`${policy}；${positions}`,row:0,col:1,readyAt:0},
      {id:'k',title:'上游 K 投影',lane:'一个 key',detail:`K = ${vec(t.k)}；与 Q 采用同样配对`,row:0,col:2,readyAt:0},
      {id:'angles',title:'计算各对旋转角',lane:'位置映射',detail:`Q 角度 ${vec(t.pairs.map(x=>x.qAngle))}；K 角度 ${vec(t.pairs.map(x=>x.kAngle))} rad`,row:1,col:1,readyAt:3},
      {id:'qr',title:'旋转 Q 的每一对',lane:'Q 分支',detail:`Q′ = ${vec(t.qRot)}`,row:2,col:0,readyAt:4},
      {id:'kr',title:'旋转 K 的每一对',lane:'K 分支',detail:`K′ = ${vec(t.kRot)}`,row:2,col:2,readyAt:5},
      {id:'dot',title:'合计各对点积',lane:'Attention score',detail:`Q′·K′ = ${f(t.score)}；相对位置重算 = ${f(t.relativeScore)}`,row:3,col:1,readyAt:6},
      {id:'logit',title:'交给注意力打分',lane:'下游消费者',detail:`logit = ${f(t.logit)}；后续与其他 keys 的 logits 一起做 mask / softmax`,row:4,col:1,readyAt:7}
    ];
    const edges=[
      {id:'positions',from:'policy',to:'angles',label:'有效位置 × 每对频率 → 旋转角',steps:[2,3]},
      {id:'qinput',from:'q',to:'qr',label:'相邻两维 Q[2i:2i+2]',steps:[4],group:'query'},
      {id:'qangle',from:'angles',to:'qr',label:'cos(mθᵢ)、sin(mθᵢ)',steps:[4]},
      {id:'kinput',from:'k',to:'kr',label:'相邻两维 K[2i:2i+2]',steps:[5],group:'key'},
      {id:'kangle',from:'angles',to:'kr',label:'cos(nθᵢ)、sin(nθᵢ)',steps:[5]},
      {id:'qscore',from:'qr',to:'dot',label:'旋转后的 Q′ 各维',steps:[6],group:'query'},
      {id:'kscore',from:'kr',to:'dot',label:'旋转后的 K′ 各维',steps:[6],group:'key'},
      {id:'scaled',from:'dot',to:'logit',label:'点积除以 √d → 一个 key 的 logit',steps:[7]}
    ];
    const steps=[
      {title:'接收同一 attention head 的 Q 与 K',summary:`本例只取一个 query、一个 key，d=${t.d}。它们来自内容投影，位置尚未旋入。`,activeNodes:['q','k'],activeEdges:[],state:{q:nodes[0].detail,k:nodes[2].detail},tables:[pairTable],plots:[],notes:['配对采用相邻两维；另一些实现使用前后半维配对，数学可等价，但坐标排列必须一致。']},
      {title:'把位置映射到各对频率',summary:interpolation?`教学位置插值：把 m、n 同时除以 s=${p.scale}，再使用原频率。`:`${policy}。同一维度对的 Q/K 共用频率。`,activeNodes:['policy','angles'],activeEdges:['positions'],state:{angles:`${positions}；频率 ${vec(t.pairs.map(x=>x.theta))} rad/位置`},equation:interpolation?'m_eff=m/s，n_eff=n/s；θᵢ=base^(−2i/d)':policy,tables:[pairTable],plots:[],notes:interpolation?['这里仅演示 p/s 的数值映射。Position Interpolation 论文还包含模型微调；本页不模拟训练，也不代表 NTK-aware、YaRN 等所有扩展方案。']:[]},
      {title:'计算角度、cos 与 sin',summary:'有效位置乘频率，生成后面两个旋转分支需要的三角函数。',activeNodes:['policy','angles'],activeEdges:['positions'],state:{angles:nodes[3].detail},equation:'αᵢ=m_eff·θᵢ，βᵢ=n_eff·θᵢ',tables:[angleTable],plots:[],notes:[]},
      {title:'用二维旋转矩阵处理 Q',summary:`逐对相乘后拼回 Q′ = ${vec(t.qRot)}。这是坐标旋转，不是把位置向量加到 Q。`,activeNodes:['q','angles','qr'],activeEdges:['qinput','qangle'],state:{qr:nodes[4].detail},equation:'R(α)[a,b]ᵀ = [a cosα − b sinα, a sinα + b cosα]ᵀ',tables:[rotationTable('q')],plots:plots.map(x=>({...x,vectors:x.vectors.slice(0,2)})),notes:['每对旋转前后平方范数相同；显示的小数舍入不会改变内部计算。']},
      {title:'用对应位置旋转 K',summary:`K 使用 n_eff 而不是 m_eff，得到 K′ = ${vec(t.kRot)}。`,activeNodes:['k','angles','kr'],activeEdges:['kinput','kangle'],state:{qr:nodes[4].detail,kr:nodes[5].detail},equation:'K′ᵢ=R(n_eff·θᵢ)Kᵢ',tables:[rotationTable('k')],plots,notes:['本页基础 RoPE 作用于 Q/K；V 没有参与旋转。']},
      {title:'合计点积，核对相对位置',summary:`各对贡献相加为 ${f(t.score)}。把共同旋转消去，同样得到 ${f(t.relativeScore)}。`,activeNodes:['qr','kr','dot'],activeEdges:['qscore','kscore'],state:{qr:nodes[4].detail,kr:nodes[5].detail,dot:nodes[6].detail},equation:'(R(mθ)Q)ᵀ(R(nθ)K) = QᵀR((n−m)θ)K',tables:[scoreTable],plots:[],notes:['恒等式针对固定内容向量 Q/K；真实模型改变上下文后 Q/K 也可能改变。单个点积不保证随距离单调衰减。']},
      {title:'缩放打分，并检查共同平移',summary:`score/√${t.d} = ${f(t.logit)}。同时把两个原始位置加 ${p.commonShift}，点积仍为 ${f(t.shiftedScore)}。`,activeNodes:['dot','logit'],activeEdges:['scaled'],state:{dot:nodes[6].detail,logit:nodes[7].detail},equation:`attention logit = ${f(t.score)} / √${t.d} = ${f(t.logit)}`,tables:[scoreTable],plots:[{type:'bars',title:'相对位置恒等式的三次计算',labels:['旋转后点积','相对位置重算','共同平移后'],series:[{label:'点积',values:[t.score,t.relativeScore,t.shiftedScore]}],unit:'点积'}],notes:['这里只有一个 key 的分数，不能把它直接叫作 attention probability；概率需要与其他合法 keys 一起归一化。']}
    ];
    return {scope:`基础 RoPE 数学教学；固定 Q/K、相邻配对、二维正向旋转。${interpolation?'额外演示线性位置插值 p/s，不包含训练及长上下文质量验证。':'不包含频率扩展或模型专有的 attention scaling。'}`,nodes,edges,steps,
      metrics:[{label:'维度 / 配对数',value:`${t.d} / ${t.pairs.length}`},{label:'有效相对位置 n−m',value:f(t.n-t.m)},{label:'点积',value:f(t.score)},{label:'缩放后 logit',value:f(t.logit)}],
      tables:[pairTable,angleTable,scoreTable],plots,notes:['所有数值由当前控件实时计算，图和表共用一份 trace；没有运行模型或测量硬件性能。']};
  }
  window.LESSON={title:'RoPE：把位置旋入 Q 与 K',subtitle:'从二维旋转到相对位置点积，逐步复算角度、坐标与 attention logit。',kind:'基础知识',
    controls:[
      {id:'scenario',label:'场景',type:'select',value:defaults.scenario,options:[{value:'single',label:'单对二维旋转'},{value:'multi',label:'四维多频率 RoPE'},{value:'interpolation',label:'教学位置插值 p/s'}]},
      {id:'qPosition',label:'Query 位置 m',type:'number',value:defaults.qPosition,min:0,max:64,step:1},
      {id:'kPosition',label:'Key 位置 n',type:'number',value:defaults.kPosition,min:0,max:64,step:1},
      {id:'degrees',label:'每位置旋转角（度）',type:'range',value:defaults.degrees,min:0,max:180,step:1,showIf:p=>p.scenario==='single'},
      {id:'base',label:'频率基数 base',type:'number',value:defaults.base,min:10,max:100000,step:10,showIf:p=>p.scenario!=='single'},
      {id:'scale',label:'位置除数 s',type:'range',value:defaults.scale,min:1,max:8,step:0.5,showIf:p=>p.scenario==='interpolation'},
      {id:'commonShift',label:'共同位置平移 Δ',type:'number',value:defaults.commonShift,min:0,max:32,step:1}
    ],calculate,build,
    sources:[{label:'RoFormer：二维旋转、广义 RoPE 与相对位置性质（§3.2–3.3）',url:'https://arxiv.org/abs/2104.09864'},{label:'Position Interpolation：位置线性插值及微调设定',url:'https://arxiv.org/abs/2306.15595'}],
    related:[{label:'Attention 机制',href:'../attention-mechanisms/index.html'},{label:'Transformer 结构',href:'../transform/index.html'},{label:'模型结构对照',href:'../model-architecture/index.html'}]};
})();
