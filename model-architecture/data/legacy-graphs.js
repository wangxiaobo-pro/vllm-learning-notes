(()=>{const n=(id,lines,col,row,order,kind='')=>({id,lines,col,row,order,kind}); const e=(a,b,label,step,route='',optional=false)=>({a,b,label,step,route,optional});
  const diagrams = {
    main: {
      title:'整体 forward：输入 → 40 层 CED → 下一 token',
      caption:'教学形状 T=8 · 实线：主干/数据依赖；虚线：条件入口或可选旁支',
      cols:2,
      nodes:[
        n('input',['① 文本 → Embedding','input_ids [8] → h [8,5120]','也接受上游 inputs_embeds'],0,0,0),
        n('vision',['可选图像入口','ViT ×32 → Aligner','合并到图像占位 embedding'],1,0,1),
        n('expand',['② 展开 4 路残差','h [8,5120] → [8,4,5120]','初始 pre_mix = [1,0,0,0]'],0,1,2),
        n('engram',['Engram 条件记忆','token n-gram → hash → lookup','门控注入 L1、L14 层前'],1,1,3,'memory'),
        n('encoder',['③ Causal Encoder ×20','L0–19 · Attention + MoE','残差 [8,4,5120]'],0,2,4),
        n('kv',['④ L20 生成全局 KV','Encoder 输出先 hc_pre / Norm','C1：每 token 一个 KV latent'],1,2,5,'memory'),
        n('decoder',['⑤ Decoder ×20','L20–39 · Attention + MoE','读取 L20 全局 KV + 各层 SWA'],0,3,6),
        n('draft',['可选 DSpark 草稿分支','L37/38/39 入口残差取均值','3 stages · 候选块 5 tokens'],1,4,7),
        n('collapse',['⑥ hc_collapse → RMSNorm','最后 pre_mix 加权折叠 4 路','[8,4,5120] → [8,5120]'],0,4,8),
        n('logits',['⑦ compute_logits / LM head','forward 先返回 hidden_states','runner 选择位置再计算 logits'],0,5,9),
        n('sample',['⑧ 外部 sampler','logits → 下一个 token','作为后续 decode 的输入'],0,6,10)
      ],
      edges:[
        e('input','expand','② h',2),e('vision','expand','① 合并',1,'',true),
        e('input','engram','③ IDs + 历史',3,'',true),e('expand','encoder','③ H',3),
        e('engram','encoder','③ 门控记忆',3,'',true),e('encoder','kv','④ 表征',4),
        e('encoder','decoder','⑤ 残差',5),e('kv','decoder','⑤ 共享 KV',5),
        e('decoder','draft','⑤ aux',5,'',true),e('decoder','collapse','⑥ H',6),
        e('collapse','logits','⑦ hidden',7),e('logits','sample','⑧ logits',8)
      ],
      steps:[
        ['input','vision','文本嵌入与可选视觉嵌入 → inputs_embeds [8,5120]。'],
        ['expand','将每个 token 的 hidden 复制为 4 路；初始化跨子层传递的 pre_mix。'],
        ['encoder','engram','依次执行 L0–19；启用 Engram 时，在 L1、L14 的 block 前门控注入记忆。'],
        ['kv','L20 的 hc_pre + RMSNorm 读取 Encoder 末端表征，再投影出 Decoder 共享的全局 KV。'],
        ['decoder','draft','依次执行 L20–39；各层保留独立 SWA，复用 L20 全局 KV；可选采集 DSpark 的入口表征。'],
        ['collapse','按最后 ffn_pre 对 4 路残差加权折叠，再做最终 RMSNorm。'],
        ['logits','模型 forward 返回 hidden；compute_logits 另由 runner 调用。'],
        ['sample','外部 sampler 选择 token，下一轮把新 token 送回模型。']
      ]
    },
    block:{
      title:'一个 block：mHC → Attention → mHC → MoE',
      caption:'同一结构用于 L0–39 · Engram 在 L1、L14 的本 block 入口之前注入',
      cols:2,
      nodes:[
        n('hin',['① 输入 4 路残差 H','[8,4,5120]','接收上一子层 pre_mix'],0,0,0),
        n('apre',['② Attention hc_pre + Norm','按传入 pre_mix 混合 → [8,5120]','产生 post / comb / attn_pre'],0,1,1),
        n('attn',['③ 稀疏 Attention','本层 SWA + 可用全局 KV','输出 x [8,5120]'],0,2,2),
        n('apost',['④ Attention hc_post','组合残差 + 写回 Attention 输出','H′ [8,4,5120]'],0,3,3),
        n('fpre',['⑤ FFN hc_pre + RMSNorm','使用上一步生成的 attn_pre','生成 ffn_pre 交给下一层'],0,4,4),
        n('ids',['原始 token IDs','来自模型输入','选择文本 / 图像路由偏置'],1,5,5),
        n('route',['⑥ Router 计算专家分数','FP32 normalized hidden','384 experts → 选 6 个'],0,5,6),
        n('experts',['⑦ Routed experts','被选中的 6 个专家各自计算','SwiGLU → 输出加权求和'],0,6,7),
        n('shared',['⑦ Shared expert ×1','同一 normalized hidden','SwiGLU → shared output'],1,6,8),
        n('sum',['⑧ 汇总 MoE 输出','routed 加权和先乘缩放系数','再加 shared → x [8,5120]'],0,7,9),
        n('fpost',['⑨ FFN hc_post','组合 H′ + 写回 MoE 输出','[8,4,5120] + ffn_pre → 下一层'],0,8,10)
      ],
      edges:[
        e('hin','apre','② H / pre',2),e('apre','attn','③ x',3),e('attn','apost','④ x',4),
        e('hin','apost','④ residual',4,'left'),
        e('apost','fpre','⑤ H′',5),e('apre','fpre','⑤ attn_pre',5,'right'),
        e('fpre','route','⑥ FP32 x',6),e('ids','route','⑥ token IDs',6),e('route','experts','⑦ IDs / 权重',7),
        e('fpre','experts','⑦ x [8,5120]',7,'right'),
        e('fpre','shared','⑦ x',7,'right'),e('experts','sum','⑧ 加权和',8),e('shared','sum','⑧ shared',8),
        e('sum','fpost','⑨ x',9),e('apost','fpost','⑨ residual H′',9,'left')
      ],
      steps:[
        ['hin','输入 [8,4,5120] 残差与上一子层产生的 pre_mix。'],
        ['apre','hc_pre 使用 incoming pre_mix 混合 4 路；计算当前 post/comb 与下个子层使用的 attn_pre。'],
        ['attn','归一化 hidden 进入 Attention，输出仍是 [8,5120]。'],
        ['apost','hc_post 混合原 4 路 residual，并把 Attention 输出按 post 系数写回。'],
        ['fpre','FFN hc_pre 使用 attn_pre；RMSNorm 同时准备专家输入与 FP32 router 输入。'],
        ['route','ids','Router 为 384 个 routed experts 打分，选择每 token 的 6 个专家；raw IDs 决定文本/图像路由偏置。'],
        ['experts','shared','选中专家与 1 个 shared expert 处理相同归一化输入；raw token IDs 还用于文本/图像路由偏置。'],
        ['sum','按路由权重汇总 routed 输出，乘 routed_scaling_factor 后加 shared 输出，得到 [8,5120]。'],
        ['fpost','第二次 hc_post 更新 4 路残差；ffn_pre 随输出传给下一层。']
      ]
    },
    attention:{
      title:'L20 Attention：本层窗口 + 全局 KV + 稀疏选择',
      caption:'逻辑形状：未切分 TP · S 表示缓存历史长度 · 本图展开 L20（KV / TopK / candidate 源）',
      cols:3,
      nodes:[
        n('x',['① 归一化输入 x','来自 Encoder 末端','[8,5120]'],1,0,0),
        n('q',['① Q 投影','wq_a → Norm → wq_b','RoPE → [8,64,512]'],0,1,1),
        n('swa',['① 本层 SWA KV','wkv → Norm → RoPE','写 L20 窗口缓存（128）'],1,1,2,'memory'),
        n('comp',['② C1：Wkv → Norm','本轮 latent [8,512]','RoPE → KV cache [S,512]'],2,1,3,'memory'),
        n('iq',['③ Index Q / 权重','Q：从 qr 投影并旋转','权重：从当前 x 投影'],0,2,4),
        n('ik',['② Index K 缓存','从未 RoPE 的 latent 投影','k_norm → RoPE → cache'],2,2,5,'memory'),
        n('top',['③ Indexer 稀疏选择','Top512 位置 + 候选块','2048 blocks × 8 positions'],1,3,6),
        n('sparse',['④ Sparse Attention','Q + SWA KV + Top512 KV','带 causal mask / sink'],1,4,7),
        n('out',['⑤ inverse RoPE','wo_a → wo_b → [8,5120]','输出送回 hc_post'],1,5,8)
      ],
      edges:[
        e('x','q','① x',1),e('x','swa','① x',1),e('x','comp','② x',2),
        e('comp','ik','② latent',2),e('q','iq','③ qr',3),e('x','iq','③ weights',3,'left'),
        e('iq','top','③ Q / w',3),e('ik','top','③ K',3),
        e('top','sparse','④ 位置 IDs',4),e('q','sparse','④ Q',4,'left'),
        e('swa','sparse','④ 本层 KV',4,'right'),e('comp','sparse','④ 全局 KV',4,'right'),
        e('sparse','out','⑤ output',5)
      ],
      steps:[
        ['x','q','swa','输入 x 分别生成 Q 和本层 SWA KV；SWA 每层独立，窗口大小 128。'],
        ['comp','ik','L20 用独立投影生成 C1 latent；主 KV 与 index K 分别处理 RoPE 并存储。'],
        ['iq','top','L20 全局检索，输出 Top512 位置与最多 2048 个候选 block ID（每块 8 个位置）。'],
        ['sparse','Attention 同时读取本层 SWA 与 Top512 全局 KV；候选块不直接等同于实际 Attention 范围。'],
        ['out','对 Attention 输出做 inverse RoPE，再经过分组低秩 wo_a / wo_b 返回 hidden 维。']
      ]
    }
  };
window.ARCH_V41_LEGACY=diagrams;})();
