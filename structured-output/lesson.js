(() => {
  const SHA='295c062db8a48ea73bbd05d1174cb37d24bf86f9', base='https://github.com/vllm-project/vllm/blob/'+SHA+'/';
  window.LESSON={title:'结构化输出：语法约束如何进入采样',subtitle:'从 JSON Schema 到合法 token 集合，再到 logits mask、采样和语法状态推进。',kind:'框架机制',
    controls:[{id:'scenario',label:'合法词偏好',type:'select',value:'prefer-a',options:[{value:'prefer-a',label:'A 的合法 logit 更高'},{value:'prefer-b',label:'B 的合法 logit 更高'}]}],
    build(params){
      const scenario=params.scenario||'prefer-a';if(!['prefer-a','prefer-b'].includes(scenario))throw new Error('未知场景');
      const vocab=['"','A','B','C','空格','<eos>'];
      const schema={type:'string',enum:['A','B']};
      const allowedByState=[[0],[1,2],[0],[5],[]],names=['q0 等开引号','q1 等枚举值','q2 等闭引号','q3 等EOS','q4 已终止'];
      const logits=scenario==='prefer-a'?[3,4,2,9,1,0]:[3,2,4,9,1,0];
      const mask=ids=>ids.reduce((word,id)=>word|(1<<id),0);
      function distribution(q){const allowed=allowedByState[q],word=mask(allowed);const masked=logits.map((v,i)=>allowed.includes(i)?v:null);const max=Math.max(...allowed.map(i=>logits[i]));const weights=logits.map((v,i)=>allowed.includes(i)?Math.exp(v-max):0);const total=weights.reduce((a,b)=>a+b,0);return {q,allowed:[...allowed],word,masked,probs:weights.map(w=>w/total),pick:allowed.reduce((best,i)=>logits[i]>logits[best]?i:best,allowed[0])};}
      const rounds=[distribution(0),distribution(1),distribution(2),distribution(3)];
      const accepted=[],snapshots=[];let q=0,current=null,gpuPick=null,compiled=false,maskReady=false,applied=false;
      const text=()=>accepted.filter(id=>id!==5).map(id=>vocab[id]).join('');
      function accept(id){if(!allowedByState[q].includes(id))throw new Error('语法拒绝 token '+id);accepted.push(id);q++;}
      function snap(title,summary){snapshots.push({title,summary,q,accepted:[...accepted],text:text(),compiled,maskReady,applied,current:current?JSON.parse(JSON.stringify(current)):null,gpuPick});}
      snap('提交 Schema 和教学词表','请求限定输出为 JSON 字符串 "A" 或 "B"；Schema 与 tokenizer 都是语法编译的输入。');
      compiled=true;snap('编译语法，建立 matcher','固定选择 xgrammar 后端。首次编译可在线程池进行，请求等待 grammar 就绪；本页状态编号是教学标记。');
      current=rounds[0];maskReady=true;applied=true;gpuPick=current.pick;accept(gpuPick);snap('先完成开引号这一轮','q0 只允许 token 0。经过 mask、采样和回报后接受开引号，进入 q1；这一步概括前一个完整生成轮。');
      current=rounds[1];applied=false;gpuPick=null;snap('q1：生成合法 token bitmask','CPU matcher 允许 A/B，禁止高分但不合法的 C；低位 token 0 对应 bit 0，mask word=6。');
      applied=true;snap('对齐请求行并屏蔽 GPU logits','按请求 ID 对齐 bitmask 行，复制到设备；非法 token 的 logit 设为 −∞。C 的 logit=9 也不能参与选择。');
      gpuPick=current.pick;snap('GPU 采样：只选合法 token','本例 temperature=0，选择允许集合中 logit 最大的 token。CPU matcher 仍停在 q1，还没有接受 GPU 输出。');
      accept(gpuPick);snap('CPU 收到 token 后推进 matcher','Scheduler 收到模型输出后调用 accept_tokens()。状态现在才从 q1 进入 q2；采样与状态推进属于不同端。');
      current=rounds[2];gpuPick=current.pick;accept(gpuPick);snap('下一轮闭引号：形成完整 JSON','q2 只允许闭引号。该轮经过 mask→sample→回报→accept 后，文本完整，matcher 等待结束 token。');
      current=rounds[3];gpuPick=current.pick;accept(gpuPick);snap('再一轮 EOS：请求结束','q3 只允许 EOS。接受后 matcher 终止；EOS 不拼接进可见 JSON 文本。闭引号和EOS是两个生成轮。');
      const f=x=>x===null?'−∞':x;
      const table=t=>({title:'当前词表、mask 与概率',headers:['ID / token','raw logit','allowed','masked logit','softmax 概率'],rows:vocab.map((token,i)=>[i+' / '+token,t.current?logits[i]:'等待前向',t.current?(t.current.allowed.includes(i)?1:0):'未生成',t.applied&&t.current?f(t.current.masked[i]):'尚未施加',t.applied&&t.current?Number(t.current.probs[i].toFixed(6)):'—'])});
      const state=t=>({request:JSON.stringify(schema),tokenizer:'教学词表 ID0..5：'+vocab.join(' | ')+'。EOS不输出文本。',grammar:t.compiled?names[t.q]+'；已接受 IDs ['+t.accepted.join(',')+']':'未编译',mask:t.maskReady&&t.current?'当前用于该轮的 mask='+t.current.word+'（int32 1 word）；allowed=['+t.current.allowed.join(',')+']':'尚未生成 mask',logits:t.current?'本轮 raw logits=['+logits.join(',')+']；C最高，但未必合法。':'模型尚未执行；本轮 logits 未就绪',apply:t.applied&&t.current?'masked=['+t.current.masked.map(f).join(',')+']':'尚未施加当前轮 mask',sampler:t.gpuPick===null?'当前轮尚未采样':'本轮GPU输出 ID='+t.gpuPick+' / '+vocab[t.gpuPick],accept:'CPU grammar：'+names[t.q]+'；已回报文本='+JSON.stringify(t.text),output:t.q===4?'最终 JSON：'+t.text:'已回报前缀：'+JSON.stringify(t.text)+'；尚未完成'});
      const nd=(id,title,lane,row,col,readyAt=0)=>({id,title,lane,row,col,readyAt,detail:state(snapshots[8])[id]});
      const edges=[
        {id:'schema',from:'request',to:'grammar',label:'①② 控制：JSON Schema / grammar key',steps:[1,2]},
        {id:'vocab',from:'tokenizer',to:'grammar',label:'①② 数据：token ID → 字节片段',steps:[1,2]},
        {id:'fill',from:'grammar',to:'mask',label:'③④⑧⑨ CPU：fill_next_token_bitmask',steps:[3,4,8,9]},
        {id:'mask-h2d',from:'mask',to:'apply',label:'⑤ 数据：1×int32 mask（教学4 B）CPU→GPU',steps:[5,8,9]},
        {id:'raw',from:'logits',to:'apply',label:'⑤ 模型输出：6个教学 logits',steps:[5,8,9]},
        {id:'masked',from:'apply',to:'sampler',label:'⑥ GPU：合法分布 / greedy',steps:[6,8,9]},
        {id:'return',from:'sampler',to:'accept',label:'⑦ token ID 回报：GPU→CPU',steps:[7,8,9]},
        {id:'advance',from:'accept',to:'grammar',label:'⑦ CPU：accept_token 推进状态',steps:[3,7,8,9]},
        {id:'emit',from:'accept',to:'output',label:'⑦⑧⑨ 输出文本与结束状态',steps:[7,8,9]}
      ];
      const active=[['request','tokenizer'],['grammar'],['grammar','mask','sampler','accept'],['grammar','mask'],['mask','logits','apply'],['sampler'],['accept','grammar','output'],['grammar','mask','apply','sampler','accept','output'],['grammar','mask','sampler','accept','output']];
      return {scope:'vLLM '+SHA.slice(0,10)+'；GPU MRV1，单卡、同步调度、无推测解码/LoRA/推理标签，structured_outputs.backend=xgrammar，greedy。教学 tokenizer 每 token 为一个所列片段；简化语言只接受 "A"|"B" 后接 EOS，不含空白。JS 状态机是契约演示，不是运行 xgrammar 编译器所得的实测 mask；真实词表必须重新编译。',
        nodes:[nd('request','Schema','CPU · API',0,0),nd('tokenizer','Tokenizer / vocabulary','CPU · 模型配置',0,1),nd('grammar','Xgrammar matcher 状态','CPU · EngineCore',1,0,2),nd('mask','合法 token bitmask','CPU · Scheduler',1,1,3),nd('logits','模型 logits','GPU · ModelRunner',2,0,3),nd('apply','按行对齐与 logits mask','CPU → GPU',2,1,3),nd('sampler','Sampler','GPU',3,0,3),nd('accept','真实回报与 accept','CPU · Scheduler',3,1,3),nd('output','文本消费者','CPU · API',4,0,3)],edges,
        steps:snapshots.map((t,i)=>({title:t.title,summary:t.summary,activeNodes:active[i],activeEdges:edges.filter(e=>e.steps.includes(i+1)).map(e=>e.id),state:state(t),tables:[table(t)],plots:t.applied&&t.current?[{type:'bars',title:'mask 后的教学 softmax（实际选择使用 greedy）',labels:vocab,series:[{label:'概率',values:t.current.probs}],unit:'概率'}]:[],equation:t.current?'mask = Σ 2^token_id = '+t.current.word+'；非法 logit → −∞；greedy = argmax(合法 logits)':'',notes:['q0…q4是教学状态名，不是xgrammar内部状态编号。概率图用于解释mask；temperature=0实际选择不抽样。',i===5?'GPU已有本轮候选，但CPU matcher仍在q1；只有第7步真实回报后才推进。':'第3、8、9步概括各自完整生成轮；第4–7步细看枚举值这一轮。']})),
        metrics:[{label:'教学词表',value:6},{label:'每请求 mask',value:'1×int32'},{label:'完整生成轮',value:4}],tables:[table(snapshots[0])],plots:[],notes:['Schema保证输出结构/枚举成员合法，不保证业务事实正确。','仅固定源码接口得到核实；未运行GPU或外部xgrammar库。'],audit:{scenario,schema,vocab,logits,allowedByState,rounds,snapshots}
      };
    },sources:[{label:'xgrammar 编译与 matcher',url:base+'vllm/v1/structured_output/backend_xgrammar.py#L86'},{label:'Grammar bitmask 管理',url:base+'vllm/v1/structured_output/__init__.py#L330'},{label:'请求行对齐、H2D与mask',url:base+'vllm/v1/structured_output/utils.py#L101'},{label:'Scheduler 接受 token',url:base+'vllm/v1/core/sched/scheduler.py#L2185'}],related:[{label:'请求生命周期',href:'../request-lifecycle/index.html'},{label:'异步调度（独立场景）',href:'../async-scheduling/index.html'}]
  };
})();
