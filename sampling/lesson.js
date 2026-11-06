(() => {
  'use strict';
  const defaults={scenario:'clear',strategy:'sample',temperature:1,topK:4,topP:0.9,u:0.6};
  const tokens=['猫','狗','鱼','鸟','停','<eos>'];
  const cases={clear:[8,4,2,1,0.5,0.5],tie:[4,4,3,2,1,1],eos:[1,1,1,2,1,10]};
  const f=x=>Number(x.toFixed(6));
  const vec=xs=>`[${xs.map(f).join(', ')}]`;
  const softmax=xs=>{const max=Math.max(...xs);const exps=xs.map(x=>Math.exp(x-max));const sum=exps.reduce((a,b)=>a+b,0);return exps.map(x=>x/sum);};
  function calculate(input={}) {
    const p={...defaults,...input}, weights=[...cases[p.scenario]], logits=weights.map(Math.log);
    if(p.strategy==='greedy') {
      const maximum=Math.max(...logits), ties=logits.map((x,i)=>x===maximum?i:-1).filter(i=>i>=0), selected=ties[0];
      return {params:p,weights,logits,maximum,ties,selected,token:tokens[selected],stop:selected===5,decision:tokens.map((_,i)=>i===selected?1:0)};
    }
    const scaled=logits.map(x=>x/Number(p.temperature)), probabilities=softmax(scaled);
    const sorted=scaled.map((x,id)=>({id,value:x})).sort((a,b)=>b.value-a.value||a.id-b.id);
    const threshold=Number(p.topK)===0?null:sorted[Math.min(tokens.length,Number(p.topK))-1].value;
    const keepK=scaled.map(x=>threshold===null||x>=threshold);
    const massK=probabilities.reduce((s,x,i)=>s+(keepK[i]?x:0),0);
    const afterK=probabilities.map((x,i)=>keepK[i]?x/massK:0);
    const ranked=afterK.map((x,id)=>({id,p:x})).filter(x=>x.p>0).sort((a,b)=>b.p-a.p||a.id-b.id);
    const keepP=tokens.map(()=>false);
    let cumulative=0;
    for(const x of ranked) {x.before=cumulative; x.keep=cumulative<Number(p.topP); if(x.keep)keepP[x.id]=true; cumulative+=x.p;x.cumulative=cumulative;}
    // topP=1 disables this filter, including any sub-ulp positive tail.
    if(Number(p.topP)===1) for(const x of ranked){x.keep=true;keepP[x.id]=true;}
    const massP=afterK.reduce((s,x,i)=>s+(keepP[i]?x:0),0);
    const final=afterK.map((x,i)=>keepP[i]?x/massP:0);
    let total=0;
    const cdf=final.map(x=>(total+=x));
    const last=final.reduce((last,x,i)=>x>0?i:last,-1);
    for(let i=last;i<cdf.length;i++)cdf[i]=1;
    const selected=final.findIndex((x,i)=>x>0&&Number(p.u)<cdf[i]);
    const lower=selected===0?0:cdf[selected-1];
    return {params:p,weights,logits,scaled,probabilities,threshold,keepK,massK,afterK,ranked,keepP,massP,final,cdf,selected,lower,upper:cdf[selected],token:tokens[selected],stop:selected===5};
  }
  function build(input) {
    const t=calculate(input),p=t.params,greedy=p.strategy==='greedy';
    const inputTable={title:'LM head 提供的教学 logits',headers:['token ID','token','便于复算的 exp(logit)','logit = ln(权重)'],rows:tokens.map((s,i)=>[i,s,t.weights[i],f(t.logits[i])])};
    const source={id:'logits',title:'接收词表 logits',lane:'LM head 输出',detail:`词表共 ${tokens.length} 项；logits=${vec(t.logits)}`,row:0,col:0,readyAt:0};
    const endDetail=t.stop?`选中 ${t.token} (ID ${t.selected}) → 本请求完成；不再启动下一轮 decode。`:`选中 ${t.token} (ID ${t.selected}) → 追加到序列，交给下一轮模型输入。`;
    if(greedy) {
      const nodes=[source,{id:'max',title:'寻找最大 logit',lane:'确定性选择',detail:`最大值 ${f(t.maximum)}；候选 IDs ${t.ties.join(', ')}`,row:1,col:0,readyAt:2},{id:'choice',title:'处理并列最大值',lane:'本页 tie 规则',detail:`并列时选最小 token ID → ${t.selected} (${t.token})`,row:2,col:0,readyAt:3},{id:'stop',title:'检查 EOS',lane:'停止条件',detail:`ID ${t.selected} ${t.stop?'等于':'不等于'} EOS ID 5`,row:3,col:0,readyAt:4},{id:'next',title:t.stop?'完成当前请求':'追加后进入下一轮',lane:'生成状态',detail:endDetail,row:4,col:0,readyAt:5}];
      const edges=[{id:'toMax',from:'logits',to:'max',label:'全词表 logits → argmax',steps:[2]},{id:'ties',from:'max',to:'choice',label:'最大值与并列 IDs',steps:[3]},{id:'chosen',from:'choice',to:'stop',label:'确定选中的 token ID',steps:[4]},{id:'finish',from:'stop',to:'next',label:t.stop?'EOS → 完成状态':'非 EOS → 新 token 输入',steps:[5]}];
      const decisionTable={title:'Greedy 的选择结果（不是 softmax 概率）',headers:['ID','token','logit','是否并列最大','最终选中'],rows:tokens.map((s,i)=>[i,s,f(t.logits[i]),t.ties.includes(i)?'是':'否',i===t.selected?'是':'否'])};
      return {scope:'单请求、单次 next-token 决策。Greedy 独立于采样路径：不除以 0，不运行 top-k/top-p，也不读取随机数。并列时本页固定选最小 token ID。',nodes,edges,
        steps:[
          {title:'接收未归一化 logits',summary:'分值可以为任意实数；比较大小不要求先计算 softmax。',activeNodes:['logits'],activeEdges:[],state:{},tables:[inputTable],plots:[]},
          {title:'寻找全词表最大值',summary:`最大 logit 为 ${f(t.maximum)}，相应 IDs 为 ${t.ties.join(', ')}。`,activeNodes:['logits','max'],activeEdges:['toMax'],state:{max:nodes[1].detail},equation:'M = maxᵢ logitᵢ',tables:[decisionTable],plots:[]},
          {title:'确定性处理并列',summary:`本例固定选择最小 ID ${t.selected} (${t.token})；不使用随机数 u。`,activeNodes:['max','choice'],activeEdges:['ties'],state:{choice:nodes[2].detail},equation:'selected = min {i : logitᵢ = M}',tables:[decisionTable],plots:[]},
          {title:'用 token ID 判断是否结束',summary:`EOS 的 ID 是 5；本次选择 ${t.selected}，所以${t.stop?'结束生成':'继续生成'}。`,activeNodes:['choice','stop'],activeEdges:['chosen'],state:{stop:nodes[3].detail},tables:[],plots:[]},
          {title:t.stop?'记录完成状态':'追加 token 并交给下一轮',summary:endDetail,activeNodes:['stop','next'],activeEdges:['finish'],state:{next:endDetail},tables:[decisionTable],plots:[]}
        ],metrics:[{label:'策略',value:'Greedy'},{label:'并列最大数',value:t.ties.length},{label:'选择',value:`${t.selected} ${t.token}`},{label:'生成状态',value:t.stop?'完成':'继续'}],tables:[inputTable,decisionTable],plots:[],notes:['Temperature→0 的极限不等于实现中可以直接除以 0；有并列最大值时，低温采样也不必等于本页确定性的 tie 规则。']};
    }
    const probTable={title:'温度缩放与稳定 softmax',headers:['ID / token','logit','logit / T','减去缩放最大值','初始概率'],rows:tokens.map((s,i)=>[`${i} ${s}`,f(t.logits[i]),f(t.scaled[i]),f(t.scaled[i]-Math.max(...t.scaled)),f(t.probabilities[i])])};
    const kTable={title:'Top-k 阈值过滤后重新归一化',headers:['ID / token','缩放 logit','保留','过滤前概率','过滤后概率'],rows:tokens.map((s,i)=>[`${i} ${s}`,f(t.scaled[i]),t.keepK[i]?'是':'否',f(t.probabilities[i]),f(t.afterK[i])])};
    const pTable={title:'Top-p 在 top-k 的剩余分布上计算',headers:['概率排名','ID / token','top-k 后概率','之前累计','含本项累计','保留'],rows:t.ranked.map((x,i)=>[i+1,`${x.id} ${tokens[x.id]}`,f(x.p),f(x.before),f(x.cumulative),x.keep?'是':'否'])};
    const finalTable={title:'最终分布与按 token ID 排列的 CDF',headers:['ID / token','最终概率','CDF 下界','CDF 上界','u 落入本区间'],rows:tokens.map((s,i)=>[`${i} ${s}`,f(t.final[i]),f(i? t.cdf[i-1]:0),f(t.cdf[i]),i===t.selected?'是':'否'])};
    const beforePlot={type:'bars',title:'温度处理后的概率',labels:tokens,series:[{label:'softmax(logits/T)',values:t.probabilities}],unit:'概率'};
    const finalPlot={type:'bars',title:'过滤前后概率对照',labels:tokens,series:[{label:'温度后',values:t.probabilities},{label:'top-k 后',values:t.afterK},{label:'最终',values:t.final}],unit:'概率'};
    const nodes=[source,
      {id:'temp',title:'温度缩放与 softmax',lane:'全词表分布',detail:`T=${p.temperature}；概率=${vec(t.probabilities)}`,row:1,col:0,readyAt:2},
      {id:'k',title:'Top-k 阈值过滤',lane:'候选集合',detail:`k=${p.topK}${Number(p.topK)===0?'（关闭）':`；logit 阈值 ${f(t.threshold)}`}；保留 ${t.keepK.filter(Boolean).length} 项`,row:2,col:0,readyAt:3},
      {id:'p',title:'Top-p 累计过滤',lane:'候选集合',detail:`p=${p.topP}；保留 IDs ${t.keepP.flatMap((x,i)=>x?[i]:[]).join(', ')}`,row:3,col:0,readyAt:4},
      {id:'cdf',title:'最终归一化与 CDF',lane:'抽样分布',detail:`最终概率=${vec(t.final)}；CDF=${vec(t.cdf)}`,row:4,col:0,readyAt:5},
      {id:'random',title:'输入固定随机数 u',lane:'抽样输入',detail:`u=${p.u}，约定 0≤u<1；改变 u 可复现不同结果`,row:4,col:2,readyAt:0},
      {id:'choice',title:'查找 u 所在区间',lane:'逆 CDF 抽样',detail:`${f(t.lower)} ≤ ${p.u} < ${f(t.upper)} → ID ${t.selected} (${t.token})`,row:5,col:1,readyAt:6},
      {id:'next',title:t.stop?'EOS：完成当前请求':'非 EOS：追加并继续',lane:'生成状态',detail:endDetail,row:6,col:1,readyAt:7}
    ];
    const edges=[{id:'temperature',from:'logits',to:'temp',label:'logits / T → 稳定 softmax',steps:[2]},{id:'topk',from:'temp',to:'k',label:'缩放 logits 与概率 → top-k',steps:[3]},{id:'topp',from:'k',to:'p',label:'剩余候选重新归一化 → 累计概率',steps:[4]},{id:'norm',from:'p',to:'cdf',label:'最终保留集合 → 归一化概率',steps:[5]},{id:'dist',from:'cdf',to:'choice',label:'按 ID 排列的概率区间',steps:[6]},{id:'uniform',from:'random',to:'choice',label:'u ∈ [0,1)',steps:[6]},{id:'commit',from:'choice',to:'next',label:'选定 token ID → EOS 检查与序列更新',steps:[7]}];
    const steps=[
      {title:'接收当前最后位置的 logits',summary:'每个词表项只有一个分值；教学例子用 ln(权重) 方便手工复算概率，真实模型直接输出 logits。',activeNodes:['logits'],activeEdges:[],state:{},tables:[inputTable],plots:[]},
      {title:'先除以正温度，再算稳定 softmax',summary:`T=${p.temperature}。先减去最大缩放分值再取 exp，避免数值溢出；这不改变概率。`,activeNodes:['logits','temp'],activeEdges:['temperature'],state:{temp:nodes[1].detail},equation:'zᵢ=logitᵢ/T；pᵢ=exp(zᵢ−max z)/Σⱼexp(zⱼ−max z)',tables:[probTable],plots:[beforePlot],notes:['T 小使分布更集中，T 大使分布更平；T 必须大于 0。Greedy 使用单独路径。']},
      {title:'执行 top-k 并保留阈值并列项',summary:Number(p.topK)===0?'k=0 表示关闭本步，所有 token 都保留。':`第 k=${p.topK} 大的缩放 logit 为 ${f(t.threshold)}；保留 ≥ 阈值的 ${t.keepK.filter(Boolean).length} 项。`,activeNodes:['temp','k'],activeEdges:['topk'],state:{k:nodes[2].detail},equation:'保留 zᵢ ≥ 第 k 大分值；其余设为 −∞；剩余概率重新归一化',tables:[kTable],plots:[],notes:['阈值处并列会保留超过 k 项，这与 Transformers v4.52.2 的 top-k 阈值语义一致。']},
      {title:'在剩余分布上执行 top-p',summary:`按概率降序取最短前缀，使累计质量达到 p=${p.topP}；跨过阈值的那一项也保留。`,activeNodes:['k','p'],activeEdges:['topp'],state:{p:nodes[3].detail},equation:'保留最小 r 使 Σⱼ≤ᵣ p_sorted[j] ≥ top_p；至少 1 项',tables:[pTable],plots:[],notes:['本页并列概率按 token ID 升序排列。边界并列时具体保留哪个 ID 可能随框架排序规则不同；p=1 完全关闭 top-p。']},
      {title:'归一化最终候选并生成 CDF',summary:'将被过滤项概率置零，再除以保留概率之和。CDF 为方便查找按 token ID 升序累加，不再按概率大小排序。',activeNodes:['p','cdf'],activeEdges:['norm'],state:{cdf:nodes[4].detail},equation:'p_finalᵢ = p_afterKᵢ·keepᵢ / Σⱼ(p_afterKⱼ·keepⱼ)；CDFᵢ=Σⱼ≤ᵢ p_finalⱼ',tables:[finalTable],plots:[finalPlot],notes:['表中只展示舍入值；选择使用完整精度计算，并把最后有效区间上界设为 1 以消除累计舍入尾差。']},
      {title:'用固定 u 选择概率区间',summary:`u=${p.u} 落入 [${f(t.lower)}, ${f(t.upper)})，所以选择 ${t.token}。`,activeNodes:['cdf','random','choice'],activeEdges:['dist','uniform'],state:{choice:nodes[6].detail},equation:'选择首个满足 u < CDFᵢ 且 p_finalᵢ>0 的 token',tables:[finalTable],plots:[finalPlot],notes:['u 是可控的均匀抽样值，不是概率最大的 token。这里只演示逆 CDF 法，不承诺复现某个 GPU 随机数实现的逐位结果。']},
      {title:'检查 EOS 并更新生成状态',summary:endDetail,activeNodes:['choice','next'],activeEdges:['commit'],state:{next:endDetail},tables:[finalTable],plots:[],notes:['只演示 EOS 停止条件；实际服务还会检查长度、stop strings 等条件。输出一个 token 不等于重新处理整个前缀。']}
    ];
    return {scope:'单请求、单位置、6 项教学词表；无重复惩罚、约束解码或 beam search。顺序固定为 temperature → top-k → top-p → 最终归一化 → 逆 CDF(u)；并列及边界约定在步骤中单独标注。',nodes,edges,steps,
      metrics:[{label:'Top-k 后候选数',value:t.keepK.filter(Boolean).length},{label:'最终候选数',value:t.keepP.filter(Boolean).length},{label:'选择',value:`${t.selected} ${t.token}`},{label:'生成状态',value:t.stop?'完成':'继续'}],tables:[inputTable,kTable,pTable,finalTable],plots:[finalPlot],notes:['所有概率、候选和 CDF 来自当前控件的一次计算；未运行真实模型。改变过滤顺序通常会改变最终分布。']};
  }
  window.LESSON={title:'采样：从 logits 到下一个 token',subtitle:'逐项计算温度、top-k、top-p、概率区间与 EOS 决策；用固定随机数复现每一次选择。',kind:'基础知识',
    controls:[
      {id:'scenario',label:'Logits 场景',type:'select',value:defaults.scenario,options:[{value:'clear',label:'明显头部与长尾'},{value:'tie',label:'并列最大值'},{value:'eos',label:'EOS 更可能'}]},
      {id:'strategy',label:'选择策略',type:'select',value:defaults.strategy,options:[{value:'sample',label:'概率采样'},{value:'greedy',label:'Greedy（独立路径）'}]},
      {id:'temperature',label:'Temperature T',type:'range',value:defaults.temperature,min:0.05,max:2,step:0.05,showIf:p=>p.strategy==='sample'},
      {id:'topK',label:'Top-k（0 关闭）',type:'select',value:String(defaults.topK),options:Array.from({length:7},(_,k)=>({value:String(k),label:k===0?'0（关闭）':String(k)})),showIf:p=>p.strategy==='sample'},
      {id:'topP',label:'Top-p',type:'range',value:defaults.topP,min:0.05,max:1,step:0.05,showIf:p=>p.strategy==='sample'},
      {id:'u',label:'固定随机数 u ∈ [0,1)',type:'number',value:defaults.u,min:0,max:0.999999,step:0.000001,showIf:p=>p.strategy==='sample'}
    ],calculate,build,
    sources:[{label:'Transformers v4.52.2：生成配置与 greedy / sampling 参数',url:'https://huggingface.co/docs/transformers/v4.52.2/main_classes/text_generation'},{label:'Transformers v4.52.2：temperature、top-k、top-p 的执行顺序',url:'https://github.com/huggingface/transformers/blob/v4.52.2/src/transformers/generation/utils.py#L1190-L1199'},{label:'Transformers v4.52.2：top-k 阈值与 top-p 过滤实现',url:'https://github.com/huggingface/transformers/blob/v4.52.2/src/transformers/generation/logits_process.py'}],
    related:[{label:'推测解码',href:'../speculative-decoding/index.html'},{label:'Transformer 结构',href:'../transform/index.html'}]};
})();
