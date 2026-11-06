/* Storage arithmetic only; no allocator, model execution, or device profiling. */
(() => {
  const GIB = 2 ** 30, BLOCK = 16, KV_BYTES = 2;
  const profiles = {
    gqa: {name: 'GQA · 8 KV heads', heads: 8, dimension: 128},
    mha: {name: 'MHA · 32 KV heads', heads: 32, dimension: 128},
    mla: {name: 'MLA · 单个压缩向量', latent: 512, rope: 64}
  };
  const number = x => x!==0&&Math.abs(x)<0.001?x.toExponential(3):Number(x.toFixed(4)).toLocaleString('en-US');
  const gib = x => number(x / GIB) + ' GiB';
  function calculate(p) {
    const profile = profiles[p.scenario];
    const weights = p.parameters * 1e9 * Number(p.weightBits) / 8;
    const kvPerLayerToken = p.scenario === 'mla'
      ? (profile.latent + profile.rope) * KV_BYTES
      : 2 * profile.heads * profile.dimension * KV_BYTES;
    const roundedTokens = Math.ceil(p.tokens / BLOCK) * BLOCK;
    const kvPerRequest = kvPerLayerToken * p.layers * roundedTokens;
    const kv = kvPerRequest * p.concurrency;
    const reserve = p.reserve * GIB, capacity = p.capacity * GIB;
    const total = weights + kv + reserve, remaining = capacity - total;
    const maxRequests = Math.max(0, Math.floor((capacity - weights - reserve) / kvPerRequest));
    return {profile, weights, kvPerLayerToken, roundedTokens, kvPerRequest, kv, reserve, capacity, total, remaining, maxRequests};
  }
  window.LESSON = {
    title: '推理显存：权重、KV 与容量预算', kind: '基础知识',
    subtitle: '从参数量和每 token 的 KV 布局出发，逐步计算单设备上的理想存储预算；改变上下文与并发，观察容量如何变化。',
    controls: [
      {id:'scenario',label:'KV 布局',type:'select',value:'gqa',options:Object.entries(profiles).map(([value,p])=>({value,label:p.name}))},
      {id:'parameters',label:'参数量（十亿）',type:'number',value:7,min:0.1,max:200,step:0.1},
      {id:'weightBits',label:'权重存储位数',type:'select',value:'16',options:[16,8,4].map(x=>({value:String(x),label:x+' bit'}))},
      {id:'layers',label:'Attention 层数',type:'number',value:32,min:1,max:128,step:1},
      {id:'tokens',label:'每请求缓存长度（tokens）',type:'number',value:4096,min:1,max:131072,step:1},
      {id:'concurrency',label:'并发请求数',type:'number',value:4,min:1,max:256,step:1},
      {id:'capacity',label:'设备容量（GiB）',type:'number',value:24,min:1,max:512,step:1},
      {id:'reserve',label:'激活 / 工作区等预留（GiB）',type:'number',value:2,min:0,max:64,step:0.5}
    ], calculate,
    build(p) {
      const c=calculate(p),isMLA=p.scenario==='mla';
      const layout=isMLA?'(512 latent + 64 RoPE) × 2 bytes':'K + V：2 × '+c.profile.heads+' heads × 128 × 2 bytes';
      const unit=layout+' = '+number(c.kvPerLayerToken)+' bytes / 层 / token';
      const tables=[{title:'同一份预算明细',headers:['项目','计算结果','解释'],rows:[
        ['权重',gib(c.weights),number(c.weights)+' bytes；不含量化元数据'],
        ['单层每 token KV',number(c.kvPerLayerToken)+' bytes',layout],
        ['实际 / 分配 tokens',p.tokens+' / '+c.roundedTokens,'每请求按 '+BLOCK+' 对齐；各请求无前缀共享'],
        ['一个请求 KV',gib(c.kvPerRequest),p.layers+' 层 × '+c.roundedTokens+' tokens'],
        ['全部请求 KV',gib(c.kv),p.concurrency+' 个独立请求'],
        ['预留',gib(c.reserve),'用户输入的预算；不是实际测量'],
        ['总需求',gib(c.total),'权重 + KV + 预留'],
        ['剩余',gib(c.remaining),c.remaining<0?'超出容量，当前预算放不下':'按这些假设尚有余量'],
        ['理想并发上界',c.maxRequests,'相同缓存长度；不保证实际可部署']
      ]}];
      const plot={type:'stack',title:'需求与容量（超过容量的部分仍显示）',total:p.capacity,parts:[
        {label:'权重',value:c.weights/GIB},{label:'KV',value:c.kv/GIB},{label:'预留',value:p.reserve}
      ],unit:'GiB'};
      const nodes=[
        {id:'model',title:'模型存储参数',lane:'输入 · 模型配置',detail:p.parameters+'B 参数 / '+p.weightBits+' bit\n'+p.layers+' 个 Attention 层',row:0,col:0},
        {id:'request',title:'缓存需求',lane:'输入 · 请求集合',detail:p.concurrency+' 个请求 × '+p.tokens+' tokens\n'+c.profile.name,row:0,col:1},
        {id:'weights',title:'权重字节',lane:'静态存储',detail:gib(c.weights),row:1,col:0,readyAt:1},
        {id:'unit',title:'KV 单位开销',lane:'每层 / 每 token',detail:unit,row:1,col:1,readyAt:2},
        {id:'aligned',title:'按块对齐长度',lane:'每个独立请求',detail:p.tokens+' → '+c.roundedTokens+' tokens\nblock_size = '+BLOCK,row:2,col:1,readyAt:3},
        {id:'reserve',title:'工作区与激活预留',lane:'输入 · 人工预算',detail:gib(c.reserve)+'\n不由参数量直接推算',row:2,col:0},
        {id:'kv',title:'全部请求的 KV',lane:'动态存储',detail:gib(c.kv)+'\n单请求 '+gib(c.kvPerRequest),row:3,col:1,readyAt:4},
        {id:'capacity',title:'设备容量',lane:'输入 · 容量约束',detail:p.capacity+' GiB\n1 GiB = 2³⁰ bytes',row:3,col:0},
        {id:'total',title:'累加实际需求',lane:'预算计算',detail:gib(c.total)+'\n权重 + KV + 预留',row:4,col:0,readyAt:6},
        {id:'decision',title:'容量判断与并发上界',lane:'消费者 · 容量规划',detail:'剩余 '+gib(c.remaining)+'\n理想上界 '+c.maxRequests+' 个同长度请求',row:5,col:0,readyAt:7}
      ];
      const edges=[
        {id:'weight',from:'model',to:'weights',label:'参数量 × 位数 / 8',steps:[1]},
        {id:'layout',from:'request',to:'unit',label:'KV heads / 维度 / dtype',steps:[2]},
        {id:'align',from:'request',to:'aligned',label:'缓存 token 长度',steps:[3]},
        {id:'allkv',from:'aligned',to:'kv',label:'每请求分配 token 数',steps:[4]},
        {id:'kvunit',from:'unit',to:'kv',label:'每层每 token 字节数',steps:[4]},
        {id:'concurrent',from:'request',to:'kv',label:'并发请求数',steps:[4]},
        {id:'layers',from:'model',to:'kv',label:'Attention 层数',steps:[4]},
        {id:'sumweight',from:'weights',to:'total',label:'权重字节',steps:[6]},
        {id:'sumkv',from:'kv',to:'total',label:'全部 KV 字节',steps:[6]},
        {id:'sumreserve',from:'reserve',to:'total',label:'人工预留字节',steps:[5,6]},
        {id:'compare',from:'capacity',to:'decision',label:'容量约束',steps:[6,7]},
        {id:'consume',from:'total',to:'decision',label:'需求与可用 KV 空间',steps:[7]}
      ];
      return {
        scope:'单设备理想存储模型；无 TP / PP 分片，无前缀共享。KV 固定 16 bit；权重量化只计算载荷。MLA 为 576 维单向量教学布局，省略其他缓存与索引。',
        nodes,edges,steps:[
          {title:'先计算权重存储',summary:'模型参数量乘以每参数的字节数。7B 的 B 是十进制十亿；GiB 的分母是 2³⁰。',activeNodes:['model','weights'],activeEdges:['weight'],equation:p.parameters+' × 10⁹ × '+p.weightBits+' / 8 = '+number(c.weights)+' bytes = '+gib(c.weights),plots:[],tables:[]},
          {title:'确定一层、一个 token 的 KV 布局',summary:isMLA?'压缩 latent 与 RoPE 分量存为一个向量；此例没有再存一份独立 V，不能再乘 2。':'K 与 V 各有 KV heads × head dimension 个元素；GQA 使用 KV heads，而非 query heads。',activeNodes:['request','unit'],activeEdges:['layout'],equation:unit,plots:[],tables:[]},
          {title:'将上下文长度向上对齐到块',summary:'每个请求独立分配完整块。最后一个块即使没有填满，也按整块计入存储。',activeNodes:['aligned'],activeEdges:['align'],equation:'ceil('+p.tokens+' / '+BLOCK+') × '+BLOCK+' = '+c.roundedTokens+' tokens',plots:[],tables:[]},
          {title:'扩展到全部层与全部请求',summary:'单请求 KV 乘以并发数。本例各请求具有相同缓存长度，且没有共享前缀。',activeNodes:['model','request','unit','aligned','kv'],activeEdges:['allkv','layers','kvunit','concurrent'],equation:number(c.kvPerLayerToken)+' × '+p.layers+' × '+c.roundedTokens+' × '+p.concurrency+' = '+number(c.kv)+' bytes = '+gib(c.kv),plots:[],tables:[]},
          {title:'单独预留非 KV 运行空间',summary:'激活、算子工作区、图捕获、运行时等开销与实现和批次有关；这里由用户填写预算，不能从权重大小直接得到。',activeNodes:['reserve'],activeEdges:[],equation:'本例预留 = '+gib(c.reserve),plots:[],tables:[]},
          {title:'累加需求并对照容量',summary:'所有分项使用同一单位。若需求超出容量，图保留超出的部分，避免误读为可运行。',activeNodes:['weights','kv','reserve','total','capacity'],activeEdges:['sumweight','sumkv','sumreserve'],equation:gib(c.weights)+' + '+gib(c.kv)+' + '+gib(c.reserve)+' = '+gib(c.total)+'；容量 '+p.capacity+' GiB',plots:[plot],tables:tables},
          {title:'把预算交给容量规划',summary:'用扣除权重和预留后的空间除以单请求 KV，取非负整数。它是简化模型的理想上界，部署还需测量真实峰值和调度约束。',activeNodes:['total','capacity','decision'],activeEdges:['compare','consume'],equation:'max(0, floor((容量 − 权重 − 预留) / 单请求 KV)) = '+c.maxRequests}
        ],
        metrics:[{label:'需求合计',value:gib(c.total)},{label:c.remaining<0?'超出容量':'剩余容量',value:gib(Math.abs(c.remaining))},{label:'单请求 KV',value:gib(c.kvPerRequest)}],
        tables,plots:[plot],notes:[
          '这是容量算例，不启动推理框架。参数量与层数、KV 布局可独立设置，不声称对应某个现成模型。',
          '未计入量化 scale / zero-point、特殊对齐、额外缓存、共享前缀、分布式副本或切分。4 bit 表示理想紧凑存储，不保证某后端支持该组合。',
          'block_size=16 仅是算例的分配粒度。实际引擎可能先预分配 KV pool；这里计算请求所需容量，不将 pool 预分配量重复相加。'
        ]
      };
    },
    sources:[
      {label:'固定 vLLM：AttentionSpec 的 K/V 元素与 page 字节计算',url:'https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/kv_cache_interface.py#L492-L547'},
      {label:'固定 vLLM：MLAAttentionSpec 的单向量、无独立 V 说明',url:'https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/kv_cache_interface.py#L669-L690'}
    ],
    related:[{label:'权重量化',href:'../quantization/index.html'},{label:'PagedAttention',href:'../paged-attention/index.html'},{label:'混合 KV 管理',href:'../hybrid-kv-cache/index.html'}]
  };
})();
