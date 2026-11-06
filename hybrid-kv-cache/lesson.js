/* FullAttention + ordinary SlidingWindow, derived from the pinned vLLM source. */
window.LESSON = {
  title:'混合 KV：两组块表，一座共享块池',
  subtitle:'FullAttention 保留历史，SWA 释放窗口外块；prefix hit 必须满足两组共同可恢复的边界。',
  kind:'框架机制',
  controls:[{id:'scenario',label:'场景',type:'select',value:'allocate',options:[
    {value:'allocate',label:'分配 / 窗口释放（APC 关闭）'},
    {value:'prefix',label:'Prefix 命中限制（APC 开启）'}
  ]}],
  build(params) {
    const prefix = params.scenario === 'prefix';
    const size=4, windowSize=5, heads=1, headDim=2, dtypeBytes=2;
    const bytes=2*size*heads*headDim*dtypeBytes;
    const arr=x=>'['+x.map(v=>v===null?'NULL':v).join(', ')+']';
    const dims={title:'组与物理页的单位',headers:['对象','本例数值','含义'],rows:[
      ['Full 组','F0：1 层','一张请求块表；覆盖完整历史'],
      ['SWA 组','S0：1 层；window='+windowSize,'另一张请求块表；仅需窗口内 KV'],
      ['逻辑 block',size+' tokens','各组独立维护逻辑页位置'],
      ['每层物理 page',bytes+' bytes',`K/V × ${size} tokens × ${heads} head × ${headDim} dim × ${dtypeBytes} bytes`],
      ['共享池每个 block',bytes+' bytes','本例每组 1 层；一般按最大组的每块字节数计算'],
      ['NULL','保留 block ID 0','逻辑占位，不计为请求持有的有效 KV 页']
    ]};
    const scope=`vLLM 295c062db8 · V1 KVCacheManager / ${prefix?'HybridKVCacheCoordinator':'KVCacheCoordinatorNoPrefixCache（继承公共分配方法）'} · FullAttentionSpec + 普通 SlidingWindowSpec · 单卡无 CP / 无 connector / 无 speculative / 无在途 token / extra_retained_tokens=0。${prefix?'APC 开启，hash 粒度=block=4，按组查询。':'APC 关闭，非缓存块优先回收。'} page=${bytes} B、block=${size}、window=${windowSize} 均为缩放教学尺寸，不是声称可直接运行的 GPU kernel 配置。Mamba、R-SWA、环形缓存与混合页尺寸不在本例内。`;
    const nodes=[
      {id:'request',title:'① 请求与本轮边界',lane:'CPU · Scheduler',row:0,col:0,readyAt:0,detail:prefix?'B：17 token prompt；至少最后 1 token 需重算':'A：已处理 12 token；准备计算 position=12'},
      {id:'spec',title:'② 两种 KV group',lane:'CPU · KVCacheConfig',row:0,col:1,readyAt:0,detail:`F0 Full / S0 SWA；block=${size}；window=${windowSize}；page=${bytes} B`},
      {id:'manager',title:'③ KV coordinator',lane:'CPU · 编排',row:1,col:0,readyAt:2,detail:prefix?'HybridKVCacheCoordinator：各组共同命中':'NoPrefixCache：继承逐组释放 / 分配方法'},
      {id:'pool',title:'④ 同一个 BlockPool',lane:'CPU · 引用与哈希元数据',row:1,col:1,readyAt:2,detail:prefix?'hash + group ID 查找；ref=0 仍可能缓存':'两组共用 ID 池；不是各组各有一套空闲块'},
      {id:'full',title:'⑤ Full 组的请求块表',lane:'CPU → GPU metadata',row:2,col:0,readyAt:2,detail:prefix?'连续前缀命中候选':'完整历史逻辑页'},
      {id:'swa',title:'⑥ SWA 组的请求块表',lane:'CPU → GPU metadata',row:2,col:1,readyAt:2,detail:prefix?'只要求恢复点所需的连续窗口后缀':'窗口外页可替换为 NULL'},
      {id:'consumer',title:'⑦ 调度 / Attention 消费者',lane:prefix?'CPU · 继续调度':'GPU · 设备侧 KV',row:3,col:0,readyAt:prefix?6:7,detail:prefix?'共同命中长度决定从哪里重新 prefill':'两个组按自己的块表访问不同物理 KV 页'},
      {id:'result',title:'⑧ 返回与后续状态',lane:'CPU · 调度续点',row:3,col:1,readyAt:8,detail:prefix?'命中返回不等于已增加引用':'请求结束，释放有效块引用'}
    ];
    const step=(title,summary,activeNodes,activeEdges,state,tables,equation,notes=[])=>({title,summary,activeNodes,activeEdges,state,tables,equation,notes});
    let edges,steps,metrics,tables,notes;
    if (!prefix) {
      const capacity=8, initialFull=[1,2,3], initialSwa=[4,5,6];
      const processed=12, nextPosition=processed;
      const skipped=Math.max(0,processed-windowSize+1), releasedCount=Math.floor(skipped/size);
      const released=initialSwa.slice(0,releasedCount).reverse();
      const queueBefore=[7,8], queueReleased=[...released,...queueBefore];
      const nullSwa=initialSwa.map((id,i)=>i<releasedCount?null:id);
      const needFull=Math.ceil((processed+1)/size)-initialFull.length;
      const needSwa=Math.ceil((processed+1)/size)-nullSwa.length;
      const full=[...initialFull,...queueReleased.slice(0,needFull)];
      const swa=[...nullSwa,...queueReleased.slice(needFull,needFull+needSwa)];
      const queueAllocated=queueReleased.slice(needFull+needSwa);
      const active=x=>x.filter(id=>id!==null);
      const held=(f,s)=>[...active(f),...active(s)];
      const snapshot=(f,s,queue,label)=>({title:label,headers:['对象','逻辑块表 / ID 列表','有效物理块','ref 状态'],rows:[
        ['Full',arr(f),active(f).length,'各有效块 ref=1'],['SWA',arr(s),active(s).length,'各有效块 ref=1；NULL 不计'],
        ['空闲队列',arr(queue),queue.length,'各有效空闲块 ref=0'],
        ['守恒',held(f,s).length+' held + '+queue.length+' free',capacity,'不含保留 NULL']
      ]});
      const initialTable=snapshot(initialFull,initialSwa,queueBefore,'已处理 12 token 后的入口快照');
      const releasedTable=snapshot(initialFull,nullSwa,queueReleased,'窗口释放后、分配前');
      const allocatedTable=snapshot(full,swa,queueAllocated,'为 position=12 分配后的块引用');
      const fullBlock=full[Math.floor(nextPosition/size)],swaBlock=swa[Math.floor(nextPosition/size)];
      const slotTable={title:'同一个 token 的两组物理地址',headers:['组','position','逻辑页','物理块','slot','注意力可读位置'],rows:[
        ['Full',nextPosition,Math.floor(nextPosition/size),fullBlock,fullBlock*size+nextPosition%size,`0..${nextPosition}`],
        ['SWA',nextPosition,Math.floor(nextPosition/size),swaBlock,swaBlock*size+nextPosition%size,`${skipped}..${nextPosition}`]
      ]};
      const state=(f,s,q)=>({full:arr(f),swa:arr(s),pool:`有效引用=${held(f,s).length}；空闲=${arr(q)}；共 ${capacity} 个可用 block`});
      edges=[
        {id:'req-manager',from:'request',to:'manager',label:'②③ processed=12、new=1、in_flight=0',steps:[2,3]},
        {id:'spec-manager',from:'spec',to:'manager',label:'①② Full/SWA manager 分派；共享 pool',steps:[1,2]},
        {id:'manager-swa',from:'manager',to:'swa',label:'③④ 窗口外完整页 → NULL',steps:[3,4]},
        {id:'swa-pool',from:'swa',to:'pool',label:`④ block ${released.join('、')} 引用归零，优先回收`,steps:[4]},
        {id:'pool-manager',from:'pool',to:'manager',label:'⑤ 可用块数与容量检查',steps:[5]},
        {id:'pool-full',from:'pool',to:'full',label:`⑥ block ${fullBlock} 重新分配给 Full`,steps:[6]},
        {id:'pool-swa',from:'pool',to:'swa',label:`⑥ block ${swaBlock} 重新分配给 SWA`,steps:[6]},
        {id:'full-consumer',from:'full',to:'consumer',label:'⑦ Full 块表 → 历史读取与当前 KV 写入',steps:[7]},
        {id:'swa-consumer',from:'swa',to:'consumer',label:'⑦ SWA 块表 → 窗口读取与当前 KV 写入',steps:[7]},
        {id:'consumer-result',from:'consumer',to:'result',label:'⑧ 假定本轮结束后请求完成',steps:[8]},
        {id:'result-pool',from:'result',to:'pool',label:'⑧ free → 所有有效请求引用归零',steps:[8]}
      ];
      steps=[
        step('先分清 group、block 与 page','两个 group 管两套逻辑页表，但从同一个 BlockPool 领取物理块 ID；每组一层使本例每池块为 32 B。',['request','spec','manager'],['spec-manager'],{},[dims],`page_bytes = 2 × ${size} × ${heads} × ${headDim} × ${dtypeBytes} = ${bytes}`),
        step('入口：A 已处理 12 个 token','前一轮可一次 prefill 12 个 token，因此 SWA 仍持有最初三页。本轮将计算 position=12。',['request','manager','pool','full','swa'],['req-manager','spec-manager'],state(initialFull,initialSwa,queueBefore),[initialTable]),
        step('按已处理边界计算可跳过区间',`下一 query 的 SWA 范围是 ${skipped}..${nextPosition}，可释放前 ${releasedCount} 个完整页；Full 的 skipped=0。此时尚未扣引用。`,['manager','swa'],['req-manager','manager-swa'],{...state(initialFull,initialSwa,queueBefore),manager:`skip=${skipped} tokens；floor(skip/${size})=${releasedCount} pages`},[initialTable],`skipped = max(0, ${processed} − ${windowSize} + 1) = ${skipped}`),
        step('释放 SWA 旧页，留下 NULL 占位','按逆序释放旧页 5、4：ref 1→0；APC 关闭，优先放回空闲队列。Full 的 1/2/3 保留。',['swa','pool','full'],['manager-swa','swa-pool'],state(initialFull,nullSwa,queueReleased),[releasedTable],undefined,['NULL 保留逻辑页位置；不能把 [NULL,NULL,6] 压成 [6] 后当普通块表使用。']),
        step('检查本轮两组的新增需求',`总长度需要 ${processed+1} token slots。Full 和 SWA 的逻辑表长度都是 3，因此各补 1 页；可用 ${queueReleased.length} 页，需求 ${needFull+needSwa} 页。`,['pool','manager','full','swa'],['pool-manager'],state(initialFull,nullSwa,queueReleased),[releasedTable],`每组新增 = ceil(${processed+1}/${size}) − 3 = 1`),
        step('从共享池按组分配','Full 先领取 5，SWA 再领取 4；两个旧 SWA 块都被重新使用，其中 5 改由 Full 持有。重新分配时 ref 0→1。',['pool','full','swa'],['pool-full','pool-swa'],state(full,swa,queueAllocated),[allocatedTable]),
        step('分别访问 Full 与 SWA 的 KV','本页展示 CPU 分配结果如何被设备消费，不执行 attention kernel。当前 position 对两组落到不同 block/slot。',['full','swa','consumer'],['full-consumer','swa-consumer'],{...state(full,swa,queueAllocated),consumer:`Full slot=${fullBlock*size}；SWA slot=${swaBlock*size}；窗口内旧 KV 在 SWA block 6`},[allocatedTable,slotTable]),
        step('请求结束，归还全部有效引用','free 删除两组 req_to_blocks；忽略 NULL 的有效 KV 计数后，6 个持有块都变为可回收。本例未开启 APC。',['consumer','result','pool'],['consumer-result','result-pool'],{full:'请求表已删除',swa:'请求表已删除',pool:`held=0；free=${capacity}；所有有效块 ref=0`,result:'返回调度器：请求生命周期结束，后续请求可复用这些块。'},[{title:'完成后的引用守恒',headers:['持有块','空闲块','总可用块'],rows:[[0,capacity,capacity]]}])
      ];
      metrics=[{label:'池共享',value:'2 groups / 1 pool'},{label:'窗口释放',value:releasedCount+' blocks'},{label:'本轮新增',value:(needFull+needSwa)+' blocks'},{label:'每池 block',value:bytes+' B（教学）'}];
      tables=[dims,allocatedTable,slotTable];
      notes=['池共有 9 个 ID；0 为保留 NULL，表中只核算其余 8 个可分配块。','没有 APC 时空闲块不保证保留可查询的 prefix hash；释放只改变引用/分配资格，不表示 GPU 内存被归还给系统。'];
    } else {
      const prompt=17, maxHit=prompt-1, needed=Math.ceil((windowSize-1)/size);
      const fullCache=[1,2,3,4],swaCache=[null,null,7,null];
      let run=0, swaHit=0;
      for(let i=Math.floor(maxHit/size)-1;i>=0;i--){run=swaCache[i]===null?0:run+1;if(run>=needed){swaHit=(i+run)*size;break;}}
      const fullHit=fullCache.length*size,common=Math.min(fullHit,swaHit);
      const full=fullCache.slice(0,common/size),swa=swaCache.slice(0,common/size);
      const gap=fullHit-common,sharedBoundary=gap?common+gap:0;
      const remaining=prompt-common;
      const lookup={title:'查询前缓存状态（独立给定快照）',headers:['逻辑页','token 区间','Full hash → block','SWA hash → block'],rows:fullCache.map((id,i)=>[i,`${i*size}..${(i+1)*size-1}`,id,swaCache[i]===null?'未缓存 / 已被驱逐':swaCache[i]])};
      const resultTable={title:'Prefix 返回值与其不同含义',headers:['字段','数值','含义'],rows:[
        ['Full 单组命中',fullHit,'连续历史候选'],['SWA 单组命中',swaHit,'恢复点前窗口 KV 足够'],
        ['num_new_computed_tokens',common,'共同可直接复用长度'],['num_uncached_common_prefix_tokens',gap,'coordinator 的未补齐共同前缀差'],
        ['shared_prefix_boundary',sharedBoundary,'KVCacheManager 返回的后续保留边界；不是已计算长度'],
        ['还需 prefill token 数',remaining,`positions ${common}..${prompt-1}`]
      ]};
      const blocksTable={title:'共同边界对应的候选块',headers:['组','返回逻辑表','有效块数','为什么足够'],rows:[
        ['Full',arr(full),full.filter(x=>x!==null).length,`保存 0..${common-1} 历史`],
        ['SWA',arr(swa),swa.filter(x=>x!==null).length,`下一 query=${common} 只需旧 KV ${common-windowSize+1}..${common-1}`]
      ]};
      const stable={pool:'查询期间不增加 ref；缓存块可处于 ref=0 且仍有 hash 的状态。',full:arr(full),swa:arr(swa)};
      edges=[
        {id:'req-manager',from:'request',to:'manager',label:`② prompt−1=${maxHit}，保留 logits 重算入口`,steps:[2]},
        {id:'spec-manager',from:'spec',to:'manager',label:'①② 按 Full/SWA 注册的 manager 分派',steps:[1,2]},
        {id:'pool-full',from:'pool',to:'full',label:'③ hash + Full group ID → 连续前缀候选',steps:[3]},
        {id:'pool-swa',from:'pool',to:'swa',label:'④ hash + SWA group ID → 窗口后缀候选',steps:[4]},
        {id:'full-manager',from:'full',to:'manager',label:`⑤ Full=${fullHit} → 裁到共同边界${common}`,steps:[5]},
        {id:'swa-manager',from:'swa',to:'manager',label:`⑤ SWA=${swaHit} 限制共同可恢复长度`,steps:[5]},
        {id:'manager-consumer',from:'manager',to:'consumer',label:`⑥ 返回 blocks + hit${common} + gap${gap}`,steps:[6]},
        {id:'consumer-result',from:'consumer',to:'result',label:`⑦⑧ hit${common} / shared_prefix_boundary${sharedBoundary} → 调度续点`,steps:[7,8]}
      ];
      steps=[
        step('设置一个真实支持的混合组合','两个 group 的 block/hash 粒度都是 4。窗口大小 5，因此恢复点前只需 1 个完整旧 KV 页；Full 仍需连续前缀。',['request','spec','manager'],['spec-manager'],{},[dims],`SWA 连续页需求 = ceil((${windowSize}−1)/${size}) = ${needed}`),
        step('限制最大命中到 prompt−1','B 有 17 个 token；即便全有缓存，也要保留最后 token 的 logits 计算。此处 lookup 尚未触碰引用计数。',['request','manager','pool'],['req-manager','spec-manager'],{pool:'缓存元数据快照已给定；查询本身不 touch/ref++。'},[lookup],`max_cache_hit_length = ${prompt} − 1 = ${maxHit}`),
        step('Full 组先找到 16 token 候选','按前缀 hash 顺序查询到 4 个连续 Full 块；SWA 是否足够尚未确定，不能直接跳过 16 个 token。',['pool','full','manager'],['pool-full'],{pool:'只读 hash 索引；ref 不变。',full:arr(fullCache),swa:'尚未完成 SWA 查询'},[lookup]),
        step('SWA 从右向左检查恢复窗口','页 3 的 SWA KV 缺失；页 2 的 block 7 仍缓存，满足 1 页窗口需求，因此只能恢复到 position=12。前两页以 NULL 占位。',['pool','swa','manager'],['pool-swa'],{pool:'SWA hash 查询与 Full 使用不同 group ID。',full:arr(fullCache),swa:arr(swa)},[lookup],`SWA hit = (${common/size}) × ${size} = ${swaHit}`),
        step('协调到共同边界 12','simple hybrid 分支将 Full 候选裁到 3 页；Full 多出的第 4 页仍在缓存中，只是不属于这次返回的直接命中。',['full','swa','manager'],['full-manager','swa-manager'],{...stable,manager:`共同 hit=${common}；最长单组 hit=${fullHit}；gap=${gap}`},[blocksTable],`common = min(${fullHit}, ${swaHit}) = ${common}`),
        step('从 coordinator 返回三元结果','返回按组组织的候选 blocks、共同命中 12、未补齐差值 4。SWA 并不需要把窗口外的历史 KV 全部找回。',['manager','consumer'],['manager-consumer'],{...stable,consumer:`blocks=(Full ${arr(full)}, SWA ${arr(swa)})；hit=${common}；gap=${gap}`},[blocksTable]),
        step('转换成保留边界，交给调度器','get_computed_blocks 把 hit+gap 转成 shared_prefix_boundary=16，用于后续稀疏保留策略。实际跳过的计算仍然只有 12。',['consumer','result'],['consumer-result'],{...stable,result:`直接复用 ${common}；后续保留边界 ${sharedBoundary}；剩余 ${remaining} tokens`},[resultTable],`shared_prefix_boundary = ${common} + ${gap} = ${sharedBoundary}`),
        step('继续分配后才取得引用','调度器若决定接纳 B，后续 allocate_slots / allocate_new_computed_blocks 才 touch 命中块并把它们挂到 B。当前查询结果不表示已经完成分配，也不表示剩余 prefill 已执行。',['consumer','result','pool'],['consumer-result'],{...stable,result:`下一步：为 positions ${common}..${prompt-1} 分配/计算；本页停在 lookup 返回续点。`},[resultTable,blocksTable],undefined,['缓存命中快照是给定教学输入；不声称展示了驱逐这些 SWA 页的完整历史。','普通 Full+SWA 的这条 simple-hybrid 路径不能直接推广到 Mamba 或任意混合缓存配置。'])
      ];
      metrics=[{label:'Full 候选',value:fullHit+' tokens'},{label:'SWA 可恢复',value:swaHit+' tokens'},{label:'共同命中',value:common+' tokens'},{label:'还需 prefill',value:remaining+' tokens'}];
      tables=[dims,lookup,resultTable,blocksTable];
      notes=['hash 查询按 group 区分；Full block 3 和 SWA block 7 不能互换。','shared_prefix_boundary=16 是后续保留提示，不是 B 已完成 16 token 的证据。'];
    }
    return {scope,nodes,edges,steps,metrics,tables,plots:[],notes:[...notes,'全部数值由本页同一数据构建；未运行 GPU/NPU 推理，未测性能。']};
  },
  sources:[
    {label:'Hybrid coordinator：共同命中边界',url:'https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/core/kv_cache_coordinator.py#L809'},
    {label:'SWA：窗口释放与命中后缀',url:'https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/core/single_type_kv_cache_manager.py#L961'},
    {label:'共享池每块字节数',url:'https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/core/kv_cache_utils.py#L1712'}
  ],
  related:[{label:'Scheduler',href:'../scheduler/index.html'},{label:'Prefix KV Cache',href:'../prefix-kv-cache/index.html'},{label:'ModelRunner 输入',href:'../modelrunner-inputs/index.html'}]
};
