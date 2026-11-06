/* Deterministic metric arithmetic; timestamps and hardware ceilings are teaching inputs. */
(() => {
  const f=x=>x!==0&&Math.abs(x)<0.001?x.toExponential(3):Number(x.toFixed(4)).toLocaleString('en-US');
  function requestMetrics(request) {
    const first=request.tokens[0],last=request.tokens.at(-1),count=request.tokens.length;
    const gaps=request.tokens.slice(1).map((t,i)=>t-request.tokens[i]);
    return {...request,count,first,last,ttft:first-request.submit,e2e:last-request.submit,gaps,tpot:count>1?(last-first)/(count-1):null};
  }
  function calculate(p) {
    if(p.scenario==='roofline') {
      const m=Number(p.rows),k=4096,n=4096,bytesPerElement=2;
      const flops=2*m*k*n,bytes=(m*k+k*n+m*n)*bytesPerElement;
      const intensity=flops/bytes,computeMs=flops/(p.peak*1e12)*1000,memoryMs=bytes/(p.bandwidth*1e9)*1000;
      return {m,k,n,bytesPerElement,flops,bytes,intensity,computeMs,memoryMs,lowerMs:Math.max(computeMs,memoryMs),ridge:p.peak*1e12/(p.bandwidth*1e9),bound:computeMs>=memoryMs?'计算上限约束':'带宽上限约束'};
    }
    const scale=p.timeScale,single=p.scenario==='single';
    const requests=[{id:'A',submit:0,tokens:single?[100]:[100,110,120,135]},{id:'B',submit:20,tokens:single?[110]:[110,120,130,150]}]
      .map(r=>requestMetrics({...r,submit:r.submit*scale,tokens:r.tokens.map(t=>t*scale)}));
    const start=Math.min(...requests.map(r=>r.submit)),end=Math.max(...requests.map(r=>r.last));
    const duration=end-start,totalTokens=requests.reduce((a,r)=>a+r.count,0);
    return {requests,start,end,duration,totalTokens,tokenThroughput:totalTokens/(duration/1000),requestThroughput:requests.length/(duration/1000)};
  }
  const stream=p=>p.scenario!=='roofline';
  window.LESSON={
    title:'推理性能：时间指标与计算 / 带宽约束',kind:'基础知识',
    subtitle:'先从明确的时间戳计算 TTFT、ITL、TPOT 和吞吐，再用单个矩阵乘的 FLOPs 与字节数估算理论耗时下界。',
    controls:[
      {id:'scenario',label:'分析场景',type:'select',value:'stream',options:[{value:'stream',label:'双请求流式输出指标'},{value:'single',label:'每请求只输出一个 token'},{value:'roofline',label:'单次 GEMM 的理论下界'}]},
      {id:'timeScale',label:'时间戳倍率',type:'number',value:1,min:0.5,max:3,step:0.5,showIf:stream},
      {id:'rows',label:'GEMM 的 M（输入行数）',type:'select',value:'128',options:[{value:'1',label:'1 行：单 token 小批量示意'},{value:'128',label:'128 行：多 token / 合批示意'},{value:'2048',label:'2048 行：较大矩阵示意'}],showIf:p=>!stream(p)},
      {id:'peak',label:'假设峰值算力（TFLOP/s）',type:'number',value:100,min:1,max:2000,step:1,showIf:p=>!stream(p)},
      {id:'bandwidth',label:'假设带宽（GB/s）',type:'number',value:1000,min:10,max:10000,step:10,showIf:p=>!stream(p)}
    ],calculate,requestMetrics,
    build(p) {
      const c=calculate(p);
      if(p.scenario==='roofline') {
        const tables=[{title:'单个 GEMM 的计算与存储假设',headers:['量','数值','口径'],rows:[
          ['形状',`X[${c.m},4096] × W[4096,4096] → Y[${c.m},4096]`,'不含其他算子'],
          ['运算量',f(c.flops)+' FLOPs','每个乘加计 2 FLOPs'],
          ['访存量',f(c.bytes)+' bytes','X/W 各读一次，Y 写一次；均为 2 bytes/元素'],
          ['算术强度',f(c.intensity)+' FLOPs/byte','FLOPs / bytes'],
          ['机器拐点',f(c.ridge)+' FLOPs/byte','峰值 FLOP/s / 带宽 bytes/s'],
          ['计算耗时下界',f(c.computeMs)+' ms','FLOPs / 峰值算力'],
          ['传输耗时下界',f(c.memoryMs)+' ms','bytes / 带宽'],
          ['理想重叠下界',f(c.lowerMs)+' ms','max(计算,传输)；不是二者相加']
        ]}];
        const plots=[{type:'bars',title:'两项理论耗时下界（ms）',labels:['计算','传输','理想重叠'],series:[{label:'耗时下界',values:[c.computeMs,c.memoryMs,c.lowerMs]}],unit:'ms'}];
        return {
          scope:'单个 dense GEMM 教学模型，K=N=4096、2 bytes/元素。峰值算力与带宽均为假设输入，不对应具体 GPU/NPU；不预测完整模型性能。',
          nodes:[
            {id:'shape',title:'输入与权重形状',lane:'输入 · 矩阵',detail:`X[${c.m},4096]\nW[4096,4096]`,row:0,col:0},
            {id:'hardware',title:'假设硬件上限',lane:'输入 · 理想上界',detail:p.peak+' TFLOP/s\n'+p.bandwidth+' GB/s',row:0,col:1},
            {id:'flops',title:'计算工作量',lane:'乘加计数',detail:f(c.flops)+' FLOPs\n2 × M × K × N',row:1,col:0,readyAt:2},
            {id:'bytes',title:'数据传输量',lane:'一次读写模型',detail:f(c.bytes)+' bytes\nX + W + Y',row:1,col:1,readyAt:3},
            {id:'intensity',title:'算术强度与拐点',lane:'比例比较',detail:f(c.intensity)+' FLOPs/byte\n拐点 '+f(c.ridge),row:2,col:0,readyAt:4},
            {id:'time',title:'两种耗时下界',lane:'单位换算',detail:'计算 '+f(c.computeMs)+' ms\n传输 '+f(c.memoryMs)+' ms',row:2,col:1,readyAt:5},
            {id:'bound',title:'取较大的下界',lane:'理想重叠',detail:f(c.lowerMs)+' ms\n'+c.bound,row:3,col:0,readyAt:6},
            {id:'consumer',title:'选择后续测量方向',lane:'消费者 · 性能分析',detail:'观察实际算子耗时、有效带宽与利用率\n此图没有实测值',row:4,col:0,readyAt:7}
          ],edges:[
            {id:'count',from:'shape',to:'flops',label:'矩阵形状 → 运算量',steps:[1,2]},
            {id:'traffic',from:'shape',to:'bytes',label:'形状与 dtype → 字节数',steps:[3]},
            {id:'ratioF',from:'flops',to:'intensity',label:'FLOPs',steps:[4]},
            {id:'ratioB',from:'bytes',to:'intensity',label:'bytes',steps:[4]},
            {id:'ridge',from:'hardware',to:'intensity',label:'算力 / 带宽 → 拐点',steps:[4]},
            {id:'ceiling',from:'hardware',to:'time',label:'峰值算力 / 带宽',steps:[5]},
            {id:'timingF',from:'flops',to:'time',label:'计算工作量',steps:[5]},
            {id:'timingB',from:'bytes',to:'time',label:'传输工作量',steps:[5]},
            {id:'max',from:'time',to:'bound',label:'max(t_compute, t_memory)',steps:[6]},
            {id:'judge',from:'intensity',to:'bound',label:'强度相对拐点的位置',steps:[6]},
            {id:'profile',from:'bound',to:'consumer',label:'理论约束 → 实测问题',steps:[7]}
          ],steps:[
            {title:'固定一次 GEMM 的边界',summary:'只分析 X × W → Y。M 是此次矩阵乘的输入行数，可以来自多 token 或多个请求，不能仅凭 M 判断整个推理阶段。',activeNodes:['shape','hardware'],activeEdges:[],tables:[],plots:[]},
            {title:'按乘加数计算 FLOPs',summary:'每个输出元素执行 K 次乘加，一次乘加记两个浮点操作；共有 M×N 个输出元素。',activeNodes:['shape','flops'],activeEdges:['count'],equation:`2 × ${c.m} × 4096 × 4096 = ${f(c.flops)} FLOPs`,tables:[],plots:[]},
            {title:'按数据边界计算字节数',summary:'假设 X 与 W 各从所分析的内存层读一次，Y 写一次；省略额外读写、缓存重用差异和工作区。',activeNodes:['shape','bytes'],activeEdges:['traffic'],equation:`(${c.m}×4096 + 4096×4096 + ${c.m}×4096) × 2 = ${f(c.bytes)} bytes`,tables:[],plots:[]},
            {title:'比较算术强度与机器拐点',summary:'算术强度描述每搬运一字节能完成多少计算；拐点由该假设设备的算力与带宽之比给出。',activeNodes:['hardware','flops','bytes','intensity'],activeEdges:['ratioF','ratioB','ridge'],equation:'强度 = '+f(c.intensity)+'；拐点 = '+f(c.ridge)+' FLOPs/byte',tables:[],plots:[]},
            {title:'换算计算和传输各自的下界',summary:'TFLOP/s 按 10¹² FLOP/s，GB/s 按 10⁹ bytes/s，再由秒换算到毫秒。',activeNodes:['hardware','flops','bytes','time'],activeEdges:['ceiling','timingF','timingB'],equation:'计算 '+f(c.computeMs)+' ms；传输 '+f(c.memoryMs)+' ms'},
            {title:'理想重叠时取两者最大值',summary:'即便计算和传输完全重叠，总时间也不能低于较大的一项。真实执行存在其他开销，通常更慢。',activeNodes:['intensity','time','bound'],activeEdges:['max','judge'],equation:'max('+f(c.computeMs)+', '+f(c.memoryMs)+') = '+f(c.lowerMs)+' ms'},
            {title:'把理论结果交给实际 profiling',summary:'改变 M 观察权重读入如何被更多计算摊薄；这能提出测量方向，不能证明某次 Decode 必然受带宽限制。',activeNodes:['bound','consumer'],activeEdges:['profile']}
          ],metrics:[{label:'算术强度',value:f(c.intensity)+' FLOPs/byte'},{label:'理想耗时下界',value:f(c.lowerMs)+' ms'},{label:'本算例约束',value:c.bound}],tables,plots,
          notes:['所有性能数值均为理论算例，不是硬件测量。有效峰值、访存层级、融合、缓存、kernel 启动与通信会改变实测结果。','该模型只覆盖一次 GEMM；完整 Attention、MLP、KV 访问和调度不能直接用此耗时替代。']
        };
      }
      const requests=c.requests,[a,b]=requests;
      const timeline={type:'timeline',title:'客户端观测时间线（每个圆点恰好一个输出 token）',unit:'ms',rows:requests.map(r=>({label:r.id,segments:[{label:'首 token 前',start:r.submit,end:r.first},{label:'首 token 后',start:r.first,end:r.last}],events:r.tokens.map((time,i)=>({label:'token '+(i+1),time}))}))};
      const tables=[
        {title:'原始时间戳与逐请求指标',headers:['请求','提交 / 输出时刻（ms）','TTFT / E2E（ms）','ITL / TPOT（ms）'],rows:requests.map(r=>[r.id,f(r.submit)+' / ['+r.tokens.map(f).join(', ')+']',f(r.ttft)+' / '+f(r.e2e),r.gaps.length?'['+r.gaps.map(f).join(', ')+'] / '+f(r.tpot):'无间隔 / 不适用'])},
        {title:'统一观测窗口内的吞吐',headers:['量','计算','结果'],rows:[['时间窗口',f(c.end)+' − '+f(c.start),f(c.duration)+' ms'],['输出 token 吞吐',c.totalTokens+' / '+f(c.duration/1000),f(c.tokenThroughput)+' tokens/s'],['请求吞吐',requests.length+' / '+f(c.duration/1000),f(c.requestThroughput)+' requests/s']]}
      ];
      const ttft=requests.map(r=>r.id+'='+f(r.ttft)).join('，'),tpot=requests.map(r=>r.id+'='+(r.tpot===null?'不适用':f(r.tpot))).join('，');
      return {
        scope:'客户端时间戳教学数据；每个事件输出一个 token，E2E 截止最后一个 token。本页不推断实际服务器资源排布，也不把首 token 前的时间全部叫作 Prefill。',
        nodes:[
          {id:'events',title:'请求与输出事件',lane:'输入 · 客户端日志',detail:requests.map(r=>r.id+' 提交 '+f(r.submit)+'；输出 ['+r.tokens.map(f).join(', ')+']').join('\n'),row:0,col:0},
          {id:'first',title:'首 token 等待',lane:'逐请求 · TTFT',detail:ttft+' ms',row:1,col:0,readyAt:2},
          {id:'gaps',title:'相邻输出间隔',lane:'逐事件 · ITL',detail:requests.map(r=>r.id+' ['+r.gaps.map(f).join(', ')+'] ms').join('\n'),row:1,col:1,readyAt:3},
          {id:'average',title:'首 token 后的平均间隔',lane:'逐请求 · TPOT',detail:tpot+(a.tpot===null?'':' ms'),row:2,col:1,readyAt:4},
          {id:'e2e',title:'提交到最后 token',lane:'逐请求 · E2E',detail:requests.map(r=>r.id+'='+f(r.e2e)+' ms').join('\n'),row:2,col:0,readyAt:5},
          {id:'window',title:'全体请求的共同窗口',lane:'聚合口径',detail:f(c.start)+' → '+f(c.end)+' ms\n'+c.totalTokens+' 个输出 token / '+requests.length+' 个请求',row:3,col:0,readyAt:6},
          {id:'consumer',title:'延迟与吞吐一起阅读',lane:'消费者 · 基准分析',detail:f(c.tokenThroughput)+' tokens/s\n'+f(c.requestThroughput)+' requests/s',row:4,col:0,readyAt:7}
        ],edges:[
          {id:'ttft',from:'events',to:'first',label:'首输出 − 提交',steps:[1,2]},
          {id:'itl',from:'events',to:'gaps',label:'逐对相邻输出时间戳',steps:[3]},
          {id:'tpot',from:'gaps',to:'average',label:'间隔之和 / (N − 1)',steps:[4]},
          {id:'end',from:'events',to:'e2e',label:'末输出 − 提交',steps:[5]},
          {id:'windowdata',from:'events',to:'window',label:'最早提交、最晚输出、总数',steps:[6]},
          {id:'throughput',from:'window',to:'consumer',label:'完成量 / 共同窗口秒数',steps:[7]},
          {id:'latency',from:'first',to:'consumer',label:'逐请求首 token 延迟',steps:[7]},
          {id:'decode',from:'average',to:'consumer',label:'逐请求生成间隔',steps:[7]},
          {id:'complete',from:'e2e',to:'consumer',label:'逐请求端到端延迟',steps:[7]}
        ],steps:[
          {title:'先固定测量边界和时间戳',summary:'事件时间来自同一时钟；提交是客户端发送请求的时刻。本例每个流式事件对应一个 token。先读取原始事件，再选择统计口径。',activeNodes:['events'],activeEdges:[],plots:[timeline],tables:[tables[0]]},
          {title:'TTFT：首输出减去提交时刻',summary:'TTFT 包含提交到首 token 的全部可观察延迟，可能含网络、排队、预处理和 Prefill，不能直接等同于纯 Prefill 计算。',activeNodes:['events','first'],activeEdges:['ttft'],equation:ttft+' ms',plots:[timeline],tables:[]},
          {title:'ITL：逐个相邻输出间隔',summary:'请求内部相邻输出事件相减。真实流若一次发出多个 token，事件间隔与 token 间隔需要额外区分。',activeNodes:['events','gaps'],activeEdges:['itl'],equation:requests.map(r=>r.id+': ['+r.gaps.map(f).join(', ')+'] ms').join('；'),plots:[timeline],tables:[]},
          {title:'TPOT：首 token 后的平均耗时',summary:a.tpot===null?'只有一个输出 token，分母 N−1 为零。TPOT 应标为不适用，不能写成 0 ms。':'按请求分别计算 (E2E−TTFT)/(输出 tokens−1)，等于本例 ITL 的算术平均。不同请求先分别计算。',activeNodes:['gaps','average'],activeEdges:['tpot'],equation:tpot+(a.tpot===null?'':' ms'),plots:[timeline],tables:[]},
          {title:'E2E：最后输出减去提交时刻',summary:'本页截止点是最后一个输出 token。若基准把连接结束或客户端后处理计入结束时间，必须重新声明边界。',activeNodes:['events','e2e'],activeEdges:['end'],equation:'A='+f(a.e2e)+' ms；B='+f(b.e2e)+' ms',plots:[timeline],tables:[]},
          {title:'为吞吐选一个共同时间窗口',summary:'从最早提交到最晚输出统计所有请求。重叠请求的持续时间不能相加当作整体墙钟时长。',activeNodes:['events','window'],activeEdges:['windowdata'],equation:f(c.end)+' − '+f(c.start)+' = '+f(c.duration)+' ms',plots:[timeline],tables:[tables[1]]},
          {title:'按完成量除以窗口秒数',summary:'同时报告输出 token 吞吐、请求吞吐和逐请求延迟。此短窗口算例不代表稳态服务容量，也不包含输入 token 吞吐。',activeNodes:['first','average','e2e','window','consumer'],activeEdges:['throughput','latency','decode','complete'],equation:c.totalTokens+' / '+f(c.duration/1000)+' = '+f(c.tokenThroughput)+' tokens/s'}
        ],metrics:[{label:'输出 token 吞吐',value:f(c.tokenThroughput)+' tokens/s'},{label:'请求吞吐',value:f(c.requestThroughput)+' requests/s'},{label:'共同窗口',value:f(c.duration)+' ms'}],tables,plots:[timeline],
        notes:['时间戳属于教学数据，没有运行模型或测量硬件。请求时间线只表示客户端观测，不表示同一设备能并行执行图中所有阶段。','TPOT 是逐请求平均间隔；平均、分位数及按 token 加权的汇总不是同一个指标。这里保留逐请求数值，不混合这些口径。']
      };
    },
    sources:[
      {label:'vLLM Benchmark CLI：TTFT、TPOT 与 ITL 的定义',url:'https://docs.vllm.ai/en/latest/benchmarking/cli/'},
      {label:'NVIDIA：算术强度、计算与内存带宽限制',url:'https://docs.nvidia.com/deeplearning/performance/dl-performance-gpu-background/index.html'}
    ],related:[{label:'显存预算',href:'../memory-budget/index.html'},{label:'连续批处理',href:'../batching/index.html'},{label:'异步调度',href:'../async-scheduling/index.html'}]
  };
})();
